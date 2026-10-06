import type { FindingCounts, ReadinessLevel } from "./derive";
import type { ProjectStatus } from "./schema";
import type { BrokenProject, ProjectBundle } from "./storage";
import { pickThumbnail } from "./thumbnail";

export interface ProjectSummary {
  slug: string;
  name: string;
  clientName: string;
  description: string;
  websiteUrl: string;
  buildOrigin: string;
  status: ProjectStatus;
  updatedAt: string;
  currentRevisionId: string | null;
  reviewCount: number;
  counts: FindingCounts;
  readiness: { level: ReadinessLevel; label: string; failing: string[] };
  thumbnail: { id: string; width?: number; height?: number } | null;
  demo: boolean;
  issueCount: number;
}

export type LibraryEntry = ProjectSummary | (BrokenProject & { slug: string });

/** Updated time reflects the newest of project, review and revision records. */
export function lastActivity(bundle: ProjectBundle): string {
  return [bundle.project.updatedAt, ...bundle.reviews.map((r) => r.createdAt), ...bundle.revisions.map((r) => r.createdAt)].sort().at(-1)!;
}

export function summarize(entry: ProjectBundle | BrokenProject): LibraryEntry {
  if ("broken" in entry) return entry;
  const thumb = pickThumbnail(entry);
  return {
    slug: entry.slug,
    name: entry.project.name,
    clientName: entry.project.clientName,
    description: entry.project.description,
    websiteUrl: entry.project.websiteUrl,
    buildOrigin: entry.project.buildOrigin,
    status: entry.project.status,
    updatedAt: lastActivity(entry),
    currentRevisionId: entry.currentRevisionId,
    reviewCount: entry.reviews.length,
    counts: entry.counts,
    readiness: {
      level: entry.readiness.level,
      label: entry.readiness.label,
      failing: entry.readiness.checks.filter((c) => c.state === "fail").map((c) => c.label),
    },
    thumbnail: thumb ? { id: thumb.id, width: thumb.image?.width, height: thumb.image?.height } : null,
    demo: entry.project.demo === true,
    issueCount: entry.issues.length,
  };
}
