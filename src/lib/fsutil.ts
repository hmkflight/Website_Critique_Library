/**
 * Low-level filesystem helpers: data-root resolution, path containment,
 * content versions and atomic writes with conflict detection.
 */
import { createHash, randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { SLUG_PATTERN } from "./schema";

export class ConflictError extends Error {
  status = 409;
  constructor(message = "This file changed on disk since you loaded it. Refresh to see the latest version, then try again.") {
    super(message);
  }
}

export class NotFoundError extends Error {
  status = 404;
}

export class InputError extends Error {
  status = 400;
}

export function dataRoot(): string {
  const configured = process.env.CRITIQUE_DATA_DIR?.trim();
  // Resolved at runtime; keep the bundler from tracing the whole project.
  return path.resolve(/*turbopackIgnore: true*/ configured || path.join(process.cwd(), "library-data"));
}

export function projectsRoot(): string {
  return path.join(dataRoot(), "projects");
}

/** Resolve segments under base, refusing anything that escapes it. */
export function safeJoin(base: string, ...segments: string[]): string {
  const root = path.resolve(base);
  for (const s of segments) {
    if (s.includes("\0")) throw new InputError("Invalid path.");
  }
  const target = path.resolve(root, ...segments);
  if (target !== root && !target.startsWith(root + path.sep)) {
    throw new InputError("Path escapes the data directory.");
  }
  return target;
}

export function projectDir(slug: string): string {
  if (!SLUG_PATTERN.test(slug)) throw new InputError("Invalid project id.");
  return safeJoin(projectsRoot(), slug);
}

export function versionOf(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

/** Version token for a file that does not exist yet. */
export const ABSENT = "absent";

export async function readVersioned(file: string): Promise<{ content: string; version: string } | null> {
  try {
    const content = await fs.readFile(file, "utf8");
    return { content, version: versionOf(content) };
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

const locks = new Map<string, Promise<unknown>>();

/** Serialize read-check-write sequences for one path within this process. */
export async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(key) ?? Promise.resolve();
  const run = prev.then(fn, fn);
  const tail = run.catch(() => undefined);
  locks.set(key, tail);
  try {
    return await run;
  } finally {
    if (locks.get(key) === tail) locks.delete(key);
  }
}

/**
 * Write via temp file + rename so readers never see partial content.
 * When `baseVersion` is given, refuse if the file changed since it was read
 * (ABSENT means "must not exist yet").
 */
export async function atomicWrite(
  file: string,
  content: string | Buffer,
  opts: { baseVersion?: string } = {},
): Promise<string> {
  return withLock(file, async () => {
    if (opts.baseVersion !== undefined) {
      const current = await readVersioned(file);
      const currentVersion = current ? current.version : ABSENT;
      if (currentVersion !== opts.baseVersion) throw new ConflictError();
    }
    await fs.mkdir(path.dirname(file), { recursive: true });
    const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${randomBytes(6).toString("hex")}.tmp`);
    try {
      await fs.writeFile(tmp, content, { flag: "wx" });
      await fs.rename(tmp, file);
    } catch (e) {
      await fs.rm(tmp, { force: true });
      throw e;
    }
    return versionOf(content);
  });
}

export function toJson(value: unknown): string {
  return JSON.stringify(value, null, 2) + "\n";
}
