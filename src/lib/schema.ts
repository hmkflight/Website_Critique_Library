/**
 * Versioned record schemas shared by the app, the validation CLI, and the
 * JSON Schema export (`npm run schemas`). Every file on disk carries
 * `schemaVersion`; bump SCHEMA_VERSION only with a migration path.
 */
import { z } from "zod";

export const SCHEMA_VERSION = 1 as const;

export const CATEGORIES = [
  "VISUAL",
  "TYPOGRAPHY",
  "COLOR",
  "COMPOSITION",
  "MOTION",
  "CONTENT",
  "CLIENT_SPECIFICITY",
  "UX",
  "RESPONSIVE",
  "ACCESSIBILITY",
  "FUNCTIONAL",
  "PERFORMANCE",
  "OTHER",
] as const;

export const SEVERITIES = ["BLOCKER", "MAJOR", "MODERATE", "MINOR", "KEEP"] as const;

export const FINDING_STATUSES = ["OPEN", "IN_PROGRESS", "FIXED", "ACCEPTED", "DEFERRED"] as const;

export const PROJECT_STATUSES = [
  "AWAITING_CLAUDE_REVIEW",
  "CLAUDE_REVIEWING",
  "REVISION_IN_PROGRESS",
  "AWAITING_HUDSON_REVIEW",
  "CLIENT_READY",
  "CLIENT_FEEDBACK",
  "COMPLETE",
] as const;

export const REVIEW_STATUSES = ["IN_PROGRESS", "COMPLETE", "INCOMPLETE"] as const;

export const ASSESSMENT_VERDICTS = [
  "READY_FOR_HUDSON",
  "NEEDS_REVISION",
  "BLOCKED",
] as const;

export const CHECK_RESULTS = ["PASS", "FAIL", "NOT_RUN", "UNAVAILABLE"] as const;

export const SCREENSHOT_ROLES = ["BEFORE", "AFTER"] as const;

export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
export const REVIEW_ID_PATTERN = /^review-\d{3,}$/;
export const REVISION_ID_PATTERN = /^revision-\d{3,}$/;
export const FINDING_ID_PATTERN = /^F-\d{3,}$/;
export const SCREENSHOT_ID_PATTERN = /^shot-[a-z0-9-]{1,80}$/;

const isoDate = z.iso.datetime({ offset: true });
const nonEmpty = z.string().trim().min(1);
const text = (max: number) => z.string().max(max);

export const httpUrl = z
  .url({ protocol: /^https?$/, hostname: z.regexes.hostname })
  .max(2048);

const slug = z.string().regex(SLUG_PATTERN, "lowercase letters, digits and dashes");
const reviewId = z.string().regex(REVIEW_ID_PATTERN, "e.g. review-001");
const revisionId = z.string().regex(REVISION_ID_PATTERN, "e.g. revision-001");
const findingId = z.string().regex(FINDING_ID_PATTERN, "e.g. F-001");
const screenshotId = z.string().regex(SCREENSHOT_ID_PATTERN, "e.g. shot-home-desktop-before");

/** Relative path inside a project folder: no absolute paths, no `..`. */
const relativePath = z
  .string()
  .min(1)
  .max(300)
  .refine(
    (p) => !p.startsWith("/") && !p.includes("\\") && !p.split("/").some((s) => s === ".." || s === ""),
    "must be a relative path without '..'",
  );

// ---------------------------------------------------------------- Project

export const approvalSchema = z.object({
  approvedAt: isoDate,
  approvedBy: nonEmpty.max(80),
  /** Approval is only valid while these still identify the latest records. */
  revisionId: revisionId,
  reviewId: reviewId,
  rationale: text(4000).default(""),
});

export const hudsonAcceptanceSchema = z.object({
  findingId,
  rationale: nonEmpty.max(4000),
  acceptedAt: isoDate,
});

export const projectSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id: slug,
  name: nonEmpty.max(120),
  clientName: nonEmpty.max(120),
  description: text(4000).default(""),
  websiteUrl: httpUrl,
  repositoryUrl: httpUrl.optional(),
  localPath: text(500).optional(),
  buildOrigin: nonEmpty.max(80).default("Codex"),
  createdAt: isoDate,
  updatedAt: isoDate,
  status: z.enum(PROJECT_STATUSES),
  thumbnailScreenshotId: screenshotId.optional(),
  approval: approvalSchema.nullable().default(null),
  /** Hudson's explicit acceptance of findings (required for MAJOR to stop blocking). */
  hudsonAcceptances: z.array(hudsonAcceptanceSchema).default([]),
  /** Demo projects ship with the repo and are always labeled in the UI. */
  demo: z.boolean().optional(),
});

// ---------------------------------------------------------------- Review

export const evidenceSchema = z.object({
  kind: z.enum(["SCREENSHOT", "URL", "FILE", "NOTE"]),
  ref: nonEmpty.max(1000),
  label: text(200).optional(),
});

export const findingSchema = z.object({
  id: findingId,
  category: z.enum(CATEGORIES),
  severity: z.enum(SEVERITIES),
  title: nonEmpty.max(200),
  observation: nonEmpty.max(6000),
  location: z.object({
    page: nonEmpty.max(300),
    section: text(200).optional(),
    viewport: text(80).optional(),
  }),
  evidence: z.array(evidenceSchema).default([]),
  recommendation: text(6000).default(""),
  status: z.enum(FINDING_STATUSES),
  resolutionNotes: text(6000).optional(),
  revisionIds: z.array(revisionId).default([]),
});

export const strengthSchema = z.object({
  title: nonEmpty.max(200),
  detail: text(4000).default(""),
  evidence: z.array(evidenceSchema).default([]),
});

export const reviewSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  projectId: slug,
  id: reviewId,
  createdAt: isoDate,
  reviewer: nonEmpty.max(80).default("Claude Code"),
  /** Revision the review looked at; null for the original Codex build. */
  reviewedRevisionId: revisionId.nullable().default(null),
  reviewedCommit: text(80).optional(),
  status: z.enum(REVIEW_STATUSES),
  summary: nonEmpty.max(8000),
  strengths: z.array(strengthSchema).default([]),
  findings: z.array(findingSchema).default([]),
  missingInformation: z.array(nonEmpty.max(1000)).default([]),
  assessment: z.object({
    verdict: z.enum(ASSESSMENT_VERDICTS),
    summary: nonEmpty.max(8000),
  }),
});

// ---------------------------------------------------------------- Revision

export const checkSchema = z.object({
  name: nonEmpty.max(200),
  viewport: text(80).optional(),
  command: text(500).optional(),
  result: z.enum(CHECK_RESULTS),
  notes: text(4000).optional(),
});

export const findingUpdateSchema = z.object({
  findingId,
  status: z.enum(FINDING_STATUSES),
  resolutionNotes: text(6000).optional(),
});

export const revisionSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  projectId: slug,
  id: revisionId,
  number: z.int().positive(),
  createdAt: isoDate,
  summary: nonEmpty.max(8000),
  changes: z
    .array(
      z.object({
        description: nonEmpty.max(4000),
        findingIds: z.array(findingId).default([]),
      }),
    )
    .default([]),
  filesTouched: z.array(nonEmpty.max(500)).default([]),
  addressedFindingIds: z.array(findingId).default([]),
  newFindingIds: z.array(findingId).default([]),
  /** Status changes recorded after verification. Latest record wins. */
  findingUpdates: z.array(findingUpdateSchema).default([]),
  commit: text(80).optional(),
  screenshotIds: z.array(screenshotId).default([]),
  browserChecks: z.array(checkSchema).default([]),
  validation: z.array(checkSchema).default([]),
  limitations: z.array(nonEmpty.max(2000)).default([]),
});

// ---------------------------------------------------------------- Screenshots

export const screenshotSchema = z.object({
  id: screenshotId,
  /** Relative to the project folder, under screenshots/before or screenshots/after. */
  path: relativePath.refine(
    (p) => /^screenshots\/(before|after)\/[^/]+\.(png|jpe?g|webp)$/i.test(p),
    "must live in screenshots/before/ or screenshots/after/ and be .png, .jpg or .webp",
  ),
  role: z.enum(SCREENSHOT_ROLES),
  capturedAt: isoDate,
  page: nonEmpty.max(300),
  viewport: z.object({
    label: nonEmpty.max(40),
    width: z.int().positive().max(10000),
    height: z.int().positive().max(20000),
  }),
  /** Before and after captures of the same view share a pairId. */
  pairId: nonEmpty.max(120).regex(/^[a-z0-9-]+$/),
  reviewId: reviewId.optional(),
  revisionId: revisionId.optional(),
  image: z
    .object({ width: z.int().positive(), height: z.int().positive() })
    .optional(),
  caption: text(500).optional(),
  demoVisual: z.boolean().optional(),
});

export const screenshotManifestSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  projectId: slug,
  screenshots: z.array(screenshotSchema).default([]),
});

// ---------------------------------------------------------------- Inputs

export const createProjectInput = z.object({
  name: nonEmpty.max(120),
  clientName: nonEmpty.max(120),
  description: text(4000).default(""),
  websiteUrl: httpUrl,
  repositoryUrl: z.union([httpUrl, z.literal("")]).optional(),
  localPath: text(500).optional(),
  buildOrigin: nonEmpty.max(80).default("Codex"),
  slug: slug.optional(),
});

export const updateProjectInput = z.object({
  baseVersion: nonEmpty,
  status: z.enum(PROJECT_STATUSES).optional(),
  name: nonEmpty.max(120).optional(),
  clientName: nonEmpty.max(120).optional(),
  description: text(4000).optional(),
  websiteUrl: httpUrl.optional(),
  repositoryUrl: z.union([httpUrl, z.literal("")]).optional(),
  localPath: text(500).optional(),
  thumbnailScreenshotId: z.union([screenshotId, z.literal("")]).optional(),
});

export const approvalInput = z.object({
  baseVersion: nonEmpty,
  action: z.enum(["approve", "revoke"]),
  rationale: text(4000).default(""),
});

export const acceptanceInput = z.object({
  baseVersion: nonEmpty,
  findingId,
  /** Empty rationale removes the acceptance. */
  rationale: text(4000),
});

export const notesInput = z.object({
  baseVersion: z.string(),
  content: text(200_000),
});

export const screenshotUploadInput = z.object({
  role: z.enum(SCREENSHOT_ROLES),
  page: nonEmpty.max(300),
  viewportLabel: nonEmpty.max(40),
  viewportWidth: z.coerce.number().int().positive().max(10000),
  viewportHeight: z.coerce.number().int().positive().max(20000),
  pairId: z.string().trim().max(120).regex(/^[a-z0-9-]*$/, "lowercase letters, digits and dashes").optional(),
  revisionId: z.union([revisionId, z.literal("")]).optional(),
  reviewId: z.union([reviewId, z.literal("")]).optional(),
  caption: text(500).optional(),
});

export type Category = (typeof CATEGORIES)[number];
export type Severity = (typeof SEVERITIES)[number];
export type FindingStatus = (typeof FINDING_STATUSES)[number];
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type CheckResult = (typeof CHECK_RESULTS)[number];
export type Project = z.infer<typeof projectSchema>;
export type Review = z.infer<typeof reviewSchema>;
export type Finding = z.infer<typeof findingSchema>;
export type Revision = z.infer<typeof revisionSchema>;
export type Screenshot = z.infer<typeof screenshotSchema>;
export type ScreenshotManifest = z.infer<typeof screenshotManifestSchema>;
export type Approval = z.infer<typeof approvalSchema>;
export type HudsonAcceptance = z.infer<typeof hudsonAcceptanceSchema>;
export type Check = z.infer<typeof checkSchema>;
