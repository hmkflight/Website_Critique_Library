import { mkdtempSync, promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { ABSENT, ConflictError, atomicWrite, readVersioned, safeJoin } from "../src/lib/fsutil";
import { installDemo, removeDemo } from "../src/lib/demo";
import {
  addScreenshot,
  createProject,
  isBroken,
  loadAllProjects,
  loadProject,
  readScreenshot,
  saveNote,
  setAcceptance,
  setApproval,
  sniffImage,
  updateProject,
  type ProjectBundle,
} from "../src/lib/storage";
import { createProjectInput, reviewSchema } from "../src/lib/schema";
import { finding, review, revision } from "./fixtures";

const PNG_1x1 = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==", "base64");

let root: string;
beforeEach(() => {
  root = mkdtempSync(path.join(os.tmpdir(), "wcl-"));
  process.env.CRITIQUE_DATA_DIR = root;
});

const register = () =>
  createProject(createProjectInput.parse({ name: "Site", clientName: "Acme", websiteUrl: "https://acme.test" }));

async function bundle(slug: string): Promise<ProjectBundle> {
  const b = await loadProject(slug);
  if (isBroken(b)) throw new Error(JSON.stringify(b.issues));
  return b;
}

const write = (slug: string, rel: string, data: unknown) =>
  fs.mkdir(path.dirname(path.join(root, "projects", slug, rel)), { recursive: true }).then(() =>
    fs.writeFile(path.join(root, "projects", slug, rel), typeof data === "string" ? data : JSON.stringify(data)),
  );

describe("fs utilities", () => {
  it("rejects path traversal", () => {
    expect(() => safeJoin(root, "../etc/passwd")).toThrow();
    expect(() => safeJoin(root, "a/../../b")).toThrow();
    expect(() => safeJoin(root, "/etc/passwd")).toThrow();
    expect(safeJoin(root, "a/b")).toBe(path.join(root, "a/b"));
  });

  it("atomic write detects concurrent change", async () => {
    const f = path.join(root, "x.txt");
    const v1 = await atomicWrite(f, "one", { baseVersion: ABSENT });
    await expect(atomicWrite(f, "dup", { baseVersion: ABSENT })).rejects.toBeInstanceOf(ConflictError);
    await atomicWrite(f, "two", { baseVersion: v1 });
    await expect(atomicWrite(f, "stale", { baseVersion: v1 })).rejects.toBeInstanceOf(ConflictError);
    expect((await readVersioned(f))!.content).toBe("two");
    expect((await fs.readdir(root)).filter((n) => n.endsWith(".tmp"))).toEqual([]);
  });
});

describe("projects", () => {
  it("registers and persists a project without reviews or screenshots", async () => {
    const p = await register();
    expect(p.id).toBe("acme-site");
    const b = await bundle(p.id);
    expect(b.project.status).toBe("AWAITING_CLAUDE_REVIEW");
    expect(b.readiness.level).toBe("AWAITING_REVIEW");
    const again = await register();
    expect(again.id).toBe("acme-site-2");
  });

  it("rejects invalid website URLs and unsafe slugs", () => {
    expect(createProjectInput.safeParse({ name: "a", clientName: "b", websiteUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(createProjectInput.safeParse({ name: "a", clientName: "b", websiteUrl: "https://ok.test", slug: "../evil" }).success).toBe(false);
  });

  it("reports invalid JSON and schema errors without crashing", async () => {
    const p = await register();
    await write(p.id, "reviews/review-001.json", "{ not json");
    await write(p.id, "revisions/revision-001.json", { schemaVersion: 1, projectId: p.id, id: "revision-001" });
    const b = await bundle(p.id);
    expect(b.reviews).toHaveLength(0);
    expect(b.issues.map((i) => i.file)).toEqual(["reviews/review-001.json", "revisions/revision-001.json"]);
    expect(b.issues[0].message).toMatch(/Invalid JSON/);

    await write("broken", "project.json", "{");
    const all = await loadAllProjects();
    expect(all.find((x) => x.slug === "broken")).toMatchObject({ broken: true });
  });

  it("guards status edits with versions and CLIENT_READY with evidence", async () => {
    const p = await register();
    const b = await bundle(p.id);
    await expect(updateProject(p.id, b.projectVersion, { status: "CLIENT_READY" })).rejects.toThrow(/Cannot mark Client ready/);
    const { version } = await updateProject(p.id, b.projectVersion, { status: "CLAUDE_REVIEWING" });
    await expect(updateProject(p.id, b.projectVersion, { status: "COMPLETE" })).rejects.toBeInstanceOf(ConflictError);
    expect((await bundle(p.id)).projectVersion).toBe(version);
  });

  it("approval flow: requires evidence, ties to revision, invalidated by new revision", async () => {
    const p = await register();
    await write(p.id, "reviews/review-001.json", reviewSchema.parse({ ...review("review-001", "2026-01-01T00:00:00.000Z", [finding("F-001", { severity: "MAJOR" })]), projectId: p.id }));
    let b = await bundle(p.id);
    await expect(setApproval(p.id, b.projectVersion, "approve", "")).rejects.toThrow(/evidence/);

    await write(p.id, "revisions/revision-001.json", { ...revision(1, "2026-01-02T00:00:00.000Z"), projectId: p.id });
    b = await bundle(p.id);
    expect(b.readiness.checks.find((c) => c.id === "majors")!.state).toBe("fail");
    await setAcceptance(p.id, b.projectVersion, "F-001", "Client accepted this trade-off");
    b = await bundle(p.id);
    expect(b.readiness.evidenceReady).toBe(true);

    await setApproval(p.id, b.projectVersion, "approve", "Looks right");
    b = await bundle(p.id);
    expect(b.readiness.level).toBe("CLIENT_READY");
    await updateProject(p.id, b.projectVersion, { status: "CLIENT_READY" });

    await write(p.id, "revisions/revision-002.json", { ...revision(2, "2026-01-03T00:00:00.000Z"), projectId: p.id });
    b = await bundle(p.id);
    expect(b.readiness.approvalStale).toBe(true);
    expect(b.readiness.level).toBe("AWAITING_APPROVAL");
  });

  it("notes persist and detect conflicting edits", async () => {
    const p = await register();
    let b = await bundle(p.id);
    expect(b.notes.hudson.version).toBe(ABSENT);
    await saveNote(p.id, "hudson", ABSENT, "# Hi");
    b = await bundle(p.id);
    expect(b.notes.hudson.value).toBe("# Hi");
    await expect(saveNote(p.id, "hudson", ABSENT, "clobber")).rejects.toBeInstanceOf(ConflictError);
    expect(b.notes["client-feedback"].value).toBe("");
  });
});

describe("screenshots", () => {
  it("sniffs real image types only", () => {
    expect(sniffImage(PNG_1x1)?.ext).toBe("png");
    expect(sniffImage(Buffer.from("<svg onload=alert(1)>"))).toBeNull();
    expect(sniffImage(Buffer.from("GIF89a"))).toBeNull();
  });

  it("imports with metadata and serves only manifest entries", async () => {
    const p = await register();
    const b = await bundle(p.id);
    const meta = { role: "BEFORE" as const, page: "Home", viewportLabel: "Desktop", viewportWidth: 1440, viewportHeight: 900, image: { width: 1, height: 1 }, ext: "png" };
    const { screenshot } = await addScreenshot(p.id, b.manifestVersion, PNG_1x1, meta);
    expect(screenshot.pairId).toBe("home-desktop");
    expect(screenshot.path.startsWith("screenshots/before/")).toBe(true);
    await expect(addScreenshot(p.id, b.manifestVersion, PNG_1x1, meta)).rejects.toBeInstanceOf(ConflictError);
    const served = await readScreenshot(p.id, screenshot.id);
    expect(served.mime).toBe("image/png");
    await expect(readScreenshot(p.id, "shot-nope")).rejects.toThrow();
    await expect(addScreenshot(p.id, (await bundle(p.id)).manifestVersion, PNG_1x1, { ...meta, revisionId: "revision-404" })).rejects.toThrow(/Unknown revision/);
  });

  it("rejects manifest paths that escape the screenshots folder", async () => {
    const p = await register();
    await write(p.id, "screenshots/screenshots.json", {
      schemaVersion: 1,
      projectId: p.id,
      screenshots: [{ id: "shot-x", path: "screenshots/before/../../project.json", role: "BEFORE", capturedAt: "2026-01-01T00:00:00.000Z", page: "Home", viewport: { label: "D", width: 1, height: 1 }, pairId: "x" }],
    });
    const b = await bundle(p.id);
    expect(b.issues[0].file).toBe("screenshots/screenshots.json");
    expect(b.screenshots).toHaveLength(0);
    await expect(readScreenshot(p.id, "shot-x")).rejects.toThrow();
  });
});

describe("demo", () => {
  it("installs and removes only demo projects", async () => {
    const user = await register();
    const installed = await installDemo();
    expect(installed).toEqual(["demo-halden-ceramics"]);
    const demo = await bundle("demo-halden-ceramics");
    expect(demo.issues).toEqual([]);
    expect(demo.project.demo).toBe(true);
    expect(demo.counts.keep).toBe(1);
    expect(demo.readiness.level).toBe("NOT_READY");
    await expect(installDemo()).rejects.toBeInstanceOf(ConflictError);
    expect(await removeDemo()).toEqual(["demo-halden-ceramics"]);
    expect((await loadAllProjects()).map((x) => x.slug)).toEqual([user.id]);
  });
});
