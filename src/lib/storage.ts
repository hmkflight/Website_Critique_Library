/**
 * Library storage: reads project folders from CRITIQUE_DATA_DIR, validates
 * every record, and performs the app's own writes (project.json, notes,
 * screenshot manifest + images). Claude-authored review/revision files are
 * read-only from the app's point of view.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import type { z } from "zod";
import {
  ABSENT,
  ConflictError,
  InputError,
  NotFoundError,
  atomicWrite,
  projectDir,
  projectsRoot,
  readVersioned,
  safeJoin,
  toJson,
  versionOf,
  withLock,
} from "./fsutil";
import {
  SCHEMA_VERSION,
  SLUG_PATTERN,
  projectSchema,
  reviewSchema,
  revisionSchema,
  screenshotManifestSchema,
  type Project,
  type Review,
  type Revision,
  type Screenshot,
  type ScreenshotManifest,
} from "./schema";
import {
  computeReadiness,
  countFindings,
  currentRevision,
  deriveFindings,
  latestReview,
  sortReviews,
  sortRevisions,
  type FindingCounts,
  type FindingState,
  type Readiness,
} from "./derive";

export interface FileIssue {
  file: string;
  message: string;
}

export type NoteKind = "hudson" | "client-feedback";
export const NOTE_FILES: Record<NoteKind, string> = {
  hudson: "notes/hudson.md",
  "client-feedback": "notes/client-feedback.md",
};

export interface Versioned<T> {
  value: T;
  version: string;
}

export interface ProjectBundle {
  slug: string;
  project: Project;
  projectVersion: string;
  reviews: Review[];
  revisions: Revision[];
  screenshots: Screenshot[];
  manifestVersion: string;
  notes: Record<NoteKind, Versioned<string>>;
  findings: FindingState[];
  counts: FindingCounts;
  readiness: Readiness;
  currentRevisionId: string | null;
  latestReviewId: string | null;
  issues: FileIssue[];
}

export interface BrokenProject {
  slug: string;
  broken: true;
  issues: FileIssue[];
}

function formatZod(error: z.ZodError): string {
  return error.issues
    .slice(0, 6)
    .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("; ");
}

async function readJson<T>(
  file: string,
  schema: z.ZodType<T>,
  label: string,
): Promise<{ ok: true; value: T; version: string } | { ok: false; issue: FileIssue } | null> {
  const raw = await readVersioned(file);
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.content);
  } catch (e) {
    return { ok: false, issue: { file: label, message: `Invalid JSON: ${(e as Error).message}` } };
  }
  const result = schema.safeParse(parsed);
  if (!result.success) return { ok: false, issue: { file: label, message: formatZod(result.error) } };
  return { ok: true, value: result.data, version: raw.version };
}

async function listJson(dir: string, pattern: RegExp): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir);
    return entries.filter((f) => pattern.test(f)).sort();
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}

export async function listProjectSlugs(): Promise<string[]> {
  try {
    const entries = await fs.readdir(projectsRoot(), { withFileTypes: true });
    return entries.filter((e) => e.isDirectory() && SLUG_PATTERN.test(e.name)).map((e) => e.name).sort();
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}

export async function loadProject(slug: string): Promise<ProjectBundle | BrokenProject> {
  const dir = projectDir(slug);
  const issues: FileIssue[] = [];

  const p = await readJson(path.join(dir, "project.json"), projectSchema, "project.json");
  if (!p) {
    try {
      await fs.access(dir);
    } catch {
      throw new NotFoundError(`Project "${slug}" not found.`);
    }
    return { slug, broken: true, issues: [{ file: "project.json", message: "File is missing." }] };
  }
  if (!p.ok) return { slug, broken: true, issues: [p.issue] };
  const project = p.value;
  if (project.id !== slug) {
    issues.push({ file: "project.json", message: `id "${project.id}" does not match folder "${slug}".` });
  }

  const reviews: Review[] = [];
  for (const f of await listJson(path.join(dir, "reviews"), /\.json$/)) {
    const label = `reviews/${f}`;
    const r = await readJson(path.join(dir, "reviews", f), reviewSchema, label);
    if (!r) continue;
    if (!r.ok) {
      issues.push(r.issue);
      continue;
    }
    if (`${r.value.id}.json` !== f) issues.push({ file: label, message: `id "${r.value.id}" does not match file name.` });
    if (r.value.projectId !== slug) issues.push({ file: label, message: `projectId "${r.value.projectId}" does not match this project; skipped.` });
    else reviews.push(r.value);
  }

  const revisions: Revision[] = [];
  for (const f of await listJson(path.join(dir, "revisions"), /\.json$/)) {
    const label = `revisions/${f}`;
    const r = await readJson(path.join(dir, "revisions", f), revisionSchema, label);
    if (!r) continue;
    if (!r.ok) {
      issues.push(r.issue);
      continue;
    }
    if (`${r.value.id}.json` !== f) issues.push({ file: label, message: `id "${r.value.id}" does not match file name.` });
    if (r.value.projectId !== slug) issues.push({ file: label, message: `projectId "${r.value.projectId}" does not match this project; skipped.` });
    else revisions.push(r.value);
  }
  const numbers = revisions.map((r) => r.number);
  if (new Set(numbers).size !== numbers.length) issues.push({ file: "revisions/", message: "Two revisions share the same number." });

  let screenshots: Screenshot[] = [];
  let manifestVersion = ABSENT;
  const m = await readJson(path.join(dir, "screenshots", "screenshots.json"), screenshotManifestSchema, "screenshots/screenshots.json");
  if (m && !m.ok) {
    issues.push(m.issue);
    const raw = await readVersioned(path.join(dir, "screenshots", "screenshots.json"));
    manifestVersion = raw?.version ?? ABSENT;
  } else if (m) {
    manifestVersion = m.version;
    const ids = new Set<string>();
    for (const s of m.value.screenshots) {
      if (ids.has(s.id)) {
        issues.push({ file: "screenshots/screenshots.json", message: `Duplicate screenshot id ${s.id}.` });
        continue;
      }
      ids.add(s.id);
      const expected = s.role === "BEFORE" ? "screenshots/before/" : "screenshots/after/";
      if (!s.path.startsWith(expected)) issues.push({ file: "screenshots/screenshots.json", message: `${s.id} is ${s.role} but stored outside ${expected}.` });
      try {
        await fs.access(safeJoin(dir, s.path));
      } catch {
        issues.push({ file: s.path, message: `Image for ${s.id} is missing.` });
      }
      screenshots.push(s);
    }
  }
  screenshots = screenshots.sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));

  const notes = {} as Record<NoteKind, Versioned<string>>;
  for (const kind of Object.keys(NOTE_FILES) as NoteKind[]) {
    const raw = await readVersioned(path.join(/*turbopackIgnore: true*/ dir, NOTE_FILES[kind]));
    notes[kind] = raw ? { value: raw.content, version: raw.version } : { value: "", version: ABSENT };
  }

  const { findings, issues: derived } = deriveFindings(reviews, revisions, project);
  issues.push(...derived);
  const readiness = computeReadiness(project, reviews, revisions, findings);

  return {
    slug,
    project,
    projectVersion: p.version,
    reviews: sortReviews(reviews),
    revisions: sortRevisions(revisions),
    screenshots,
    manifestVersion,
    notes,
    findings,
    counts: countFindings(findings),
    readiness,
    currentRevisionId: currentRevision(revisions)?.id ?? null,
    latestReviewId: latestReview(reviews)?.id ?? null,
    issues,
  };
}

export function isBroken(b: ProjectBundle | BrokenProject): b is BrokenProject {
  return "broken" in b;
}

export async function loadAllProjects(): Promise<(ProjectBundle | BrokenProject)[]> {
  const slugs = await listProjectSlugs();
  return Promise.all(
    slugs.map(async (slug) => {
      try {
        return await loadProject(slug);
      } catch (e) {
        return { slug, broken: true as const, issues: [{ file: "(folder)", message: (e as Error).message }] };
      }
    }),
  );
}

async function requireBundle(slug: string): Promise<ProjectBundle> {
  const b = await loadProject(slug);
  if (isBroken(b)) throw new InputError(`Project files are invalid: ${b.issues.map((i) => `${i.file}: ${i.message}`).join("; ")}`);
  return b;
}

// ---------------------------------------------------------------- Writes

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

export async function createProject(input: {
  name: string;
  clientName: string;
  description: string;
  websiteUrl: string;
  repositoryUrl?: string;
  localPath?: string;
  buildOrigin: string;
  slug?: string;
}): Promise<Project> {
  const base = input.slug || slugify(`${input.clientName} ${input.name}`) || "project";
  if (!SLUG_PATTERN.test(base)) throw new InputError("Could not derive a valid project id; provide one.");
  const now = new Date().toISOString();
  const existing = new Set(await listProjectSlugs());
  let slug = base;
  for (let n = 2; existing.has(slug); n++) {
    if (input.slug) throw new ConflictError(`A project with id "${slug}" already exists.`);
    slug = `${base}-${n}`;
  }
  const project = projectSchema.parse({
    schemaVersion: SCHEMA_VERSION,
    id: slug,
    name: input.name,
    clientName: input.clientName,
    description: input.description,
    websiteUrl: input.websiteUrl,
    repositoryUrl: input.repositoryUrl || undefined,
    localPath: input.localPath?.trim() || undefined,
    buildOrigin: input.buildOrigin,
    createdAt: now,
    updatedAt: now,
    status: "AWAITING_CLAUDE_REVIEW",
    approval: null,
    hudsonAcceptances: [],
  });
  const dir = projectDir(slug);
  await atomicWrite(path.join(dir, "project.json"), toJson(project), { baseVersion: ABSENT });
  for (const sub of ["reviews", "revisions", "screenshots/before", "screenshots/after", "notes"]) {
    await fs.mkdir(path.join(/*turbopackIgnore: true*/ dir, sub), { recursive: true });
  }
  return project;
}

/** Read-modify-write project.json guarded by the caller's version token. */
async function mutateProject(
  slug: string,
  baseVersion: string,
  fn: (project: Project, bundle: ProjectBundle) => Project,
): Promise<{ project: Project; version: string }> {
  const file = path.join(projectDir(slug), "project.json");
  return withLock(`project:${slug}`, async () => {
    const bundle = await requireBundle(slug);
    if (bundle.projectVersion !== baseVersion) throw new ConflictError();
    const next = projectSchema.parse({ ...fn(structuredClone(bundle.project), bundle), updatedAt: new Date().toISOString() });
    const version = await atomicWrite(file, toJson(next), { baseVersion });
    return { project: next, version };
  });
}

export async function updateProject(
  slug: string,
  baseVersion: string,
  patch: Partial<Pick<Project, "status" | "name" | "clientName" | "description" | "websiteUrl" | "localPath">> & {
    repositoryUrl?: string;
    thumbnailScreenshotId?: string;
  },
) {
  return mutateProject(slug, baseVersion, (project, bundle) => {
    if (patch.status === "CLIENT_READY" && !bundle.readiness.canMarkClientReady) {
      const failing = bundle.readiness.checks.filter((c) => c.state === "fail").map((c) => c.detail);
      throw new InputError(`Cannot mark Client ready yet: ${failing.join(" ")}`);
    }
    if (patch.thumbnailScreenshotId && !bundle.screenshots.some((s) => s.id === patch.thumbnailScreenshotId)) {
      throw new InputError("Unknown screenshot for thumbnail.");
    }
    const next: Project = { ...project };
    for (const key of ["status", "name", "clientName", "description", "websiteUrl"] as const) {
      if (patch[key] !== undefined) (next as Record<string, unknown>)[key] = patch[key];
    }
    if (patch.repositoryUrl !== undefined) next.repositoryUrl = patch.repositoryUrl || undefined;
    if (patch.localPath !== undefined) next.localPath = patch.localPath.trim() || undefined;
    if (patch.thumbnailScreenshotId !== undefined) next.thumbnailScreenshotId = patch.thumbnailScreenshotId || undefined;
    return next;
  });
}

export async function setApproval(slug: string, baseVersion: string, action: "approve" | "revoke", rationale: string) {
  return mutateProject(slug, baseVersion, (project, bundle) => {
    if (action === "revoke") {
      const next = { ...project, approval: null };
      if (next.status === "CLIENT_READY") next.status = "AWAITING_HUDSON_REVIEW";
      return next;
    }
    if (!bundle.readiness.evidenceReady || !bundle.currentRevisionId || !bundle.latestReviewId) {
      const failing = bundle.readiness.checks.filter((c) => c.state === "fail" && c.id !== "approval").map((c) => c.detail);
      throw new InputError(`Approval needs complete evidence first: ${failing.join(" ") || "no revision recorded."}`);
    }
    return {
      ...project,
      approval: {
        approvedAt: new Date().toISOString(),
        approvedBy: "Hudson",
        revisionId: bundle.currentRevisionId,
        reviewId: bundle.latestReviewId,
        rationale,
      },
    };
  });
}

export async function setAcceptance(slug: string, baseVersion: string, findingId: string, rationale: string) {
  return mutateProject(slug, baseVersion, (project, bundle) => {
    if (!bundle.findings.some((f) => f.id === findingId)) throw new InputError(`Unknown finding ${findingId}.`);
    const others = project.hudsonAcceptances.filter((a) => a.findingId !== findingId);
    const trimmed = rationale.trim();
    return {
      ...project,
      hudsonAcceptances: trimmed ? [...others, { findingId, rationale: trimmed, acceptedAt: new Date().toISOString() }] : others,
    };
  });
}

export async function saveNote(slug: string, kind: NoteKind, baseVersion: string, content: string) {
  const dir = projectDir(slug);
  await requireBundle(slug);
  const version = await atomicWrite(path.join(/*turbopackIgnore: true*/ dir, NOTE_FILES[kind]), content, { baseVersion });
  return { version };
}

// ---------------------------------------------------------------- Screenshots

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export function sniffImage(buf: Buffer): { ext: "png" | "jpg" | "webp"; mime: string } | null {
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { ext: "png", mime: "image/png" };
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: "jpg", mime: "image/jpeg" };
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    return { ext: "webp", mime: "image/webp" };
  }
  return null;
}

export const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

export async function addScreenshot(
  slug: string,
  baseVersion: string,
  file: Buffer,
  meta: {
    role: "BEFORE" | "AFTER";
    page: string;
    viewportLabel: string;
    viewportWidth: number;
    viewportHeight: number;
    pairId?: string;
    revisionId?: string;
    reviewId?: string;
    caption?: string;
    image: { width: number; height: number };
    ext: string;
  },
): Promise<{ screenshot: Screenshot; version: string }> {
  const dir = projectDir(slug);
  return withLock(`manifest:${slug}`, async () => {
    const bundle = await requireBundle(slug);
    if (bundle.manifestVersion !== baseVersion) throw new ConflictError();
    if (meta.revisionId && !bundle.revisions.some((r) => r.id === meta.revisionId)) throw new InputError(`Unknown revision ${meta.revisionId}.`);
    if (meta.reviewId && !bundle.reviews.some((r) => r.id === meta.reviewId)) throw new InputError(`Unknown review ${meta.reviewId}.`);

    const pageSlug = slugify(meta.page) || "page";
    const pairId = meta.pairId || slugify(`${meta.page}-${meta.viewportLabel}`) || "view";
    const stamp = Date.now().toString(36);
    const id = `shot-${slugify(`${pairId}-${meta.role}-${stamp}`)}`.slice(0, 85);
    const roleDir = meta.role === "BEFORE" ? "before" : "after";
    const rel = `screenshots/${roleDir}/${pageSlug}-${slugify(meta.viewportLabel) || "vp"}-${stamp}.${meta.ext}`;

    const screenshot: Screenshot = {
      id,
      path: rel,
      role: meta.role,
      capturedAt: new Date().toISOString(),
      page: meta.page,
      viewport: { label: meta.viewportLabel, width: meta.viewportWidth, height: meta.viewportHeight },
      pairId,
      revisionId: meta.revisionId || undefined,
      reviewId: meta.reviewId || undefined,
      caption: meta.caption?.trim() || undefined,
      image: meta.image,
    };

    const manifestFile = path.join(dir, "screenshots", "screenshots.json");
    const raw = await readVersioned(manifestFile);
    let manifest: ScreenshotManifest;
    if (raw) {
      const parsed = screenshotManifestSchema.safeParse(JSON.parse(raw.content));
      if (!parsed.success) throw new InputError("screenshots.json is invalid; fix it before importing.");
      manifest = parsed.data;
    } else {
      manifest = { schemaVersion: SCHEMA_VERSION, projectId: slug, screenshots: [] };
    }
    manifest.screenshots.push(screenshot);
    const content = toJson(screenshotManifestSchema.parse(manifest));

    const imageFile = safeJoin(dir, rel);
    await fs.mkdir(path.dirname(imageFile), { recursive: true });
    await fs.writeFile(imageFile, file, { flag: "wx" });
    try {
      const version = await atomicWrite(manifestFile, content, { baseVersion });
      return { screenshot, version };
    } catch (e) {
      await fs.rm(imageFile, { force: true });
      throw e;
    }
  });
}

export async function readScreenshot(slug: string, id: string): Promise<{ data: Buffer; mime: string }> {
  const dir = projectDir(slug);
  const m = await readJson(path.join(dir, "screenshots", "screenshots.json"), screenshotManifestSchema, "screenshots.json");
  if (!m || !m.ok) throw new NotFoundError("Screenshot not found.");
  const shot = m.value.screenshots.find((s) => s.id === id);
  if (!shot) throw new NotFoundError("Screenshot not found.");
  const file = safeJoin(dir, "screenshots", path.relative("screenshots", shot.path));
  const mime = MIME_BY_EXT[path.extname(file).toLowerCase()];
  if (!mime) throw new NotFoundError("Unsupported screenshot type.");
  const stat = await fs.lstat(file).catch(() => null);
  if (!stat || !stat.isFile()) throw new NotFoundError("Screenshot file is missing.");
  const data = await fs.readFile(file);
  const sniffed = sniffImage(data);
  if (!sniffed || sniffed.mime !== mime) throw new NotFoundError("Screenshot content does not match its type.");
  return { data, mime };
}

export { versionOf };
