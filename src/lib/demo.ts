/**
 * The demo project ships in ./demo and is copied into the data directory on
 * request. Demo projects carry `demo: true` and a `demo-` id prefix, so
 * removal never touches user projects.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { ConflictError, InputError, projectDir, projectsRoot } from "./fsutil";
import { projectSchema } from "./schema";

export const DEMO_SOURCE = path.join(process.cwd(), "demo", "projects");

export async function listDemoSources(): Promise<string[]> {
  const entries = await fs.readdir(DEMO_SOURCE, { withFileTypes: true }).catch(() => []);
  return entries.filter((e) => e.isDirectory() && e.name.startsWith("demo-")).map((e) => e.name);
}

export async function installDemo(): Promise<string[]> {
  const installed: string[] = [];
  for (const slug of await listDemoSources()) {
    const target = projectDir(slug);
    const exists = await fs.stat(target).then(() => true, () => false);
    if (exists) throw new ConflictError(`Demo project "${slug}" is already installed.`);
    await fs.mkdir(projectsRoot(), { recursive: true });
    await fs.cp(path.join(DEMO_SOURCE, slug), target, { recursive: true, errorOnExist: true });
    installed.push(slug);
  }
  if (installed.length === 0) throw new InputError("No demo projects found in ./demo/projects.");
  return installed;
}

export async function removeDemo(): Promise<string[]> {
  const removed: string[] = [];
  const entries = await fs.readdir(projectsRoot(), { withFileTypes: true }).catch(() => []);
  for (const e of entries) {
    if (!e.isDirectory() || !e.name.startsWith("demo-")) continue;
    const dir = projectDir(e.name);
    const raw = await fs.readFile(path.join(dir, "project.json"), "utf8").catch(() => null);
    let json: unknown = null;
    try {
      json = raw ? JSON.parse(raw) : null;
    } catch {
      continue;
    }
    const parsed = json ? projectSchema.safeParse(json) : null;
    // Only delete folders that positively identify as demo content.
    if (!parsed?.success || parsed.data.demo !== true) continue;
    await fs.rm(dir, { recursive: true, force: true });
    removed.push(e.name);
  }
  return removed;
}
