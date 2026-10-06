import type { Finding, Project, Review, Revision } from "../src/lib/schema";

export const finding = (id: string, over: Partial<Finding> = {}): Finding => ({
  id,
  category: "VISUAL",
  severity: "MINOR",
  title: `Finding ${id}`,
  observation: "Observed.",
  location: { page: "Home" },
  evidence: [],
  recommendation: "",
  status: "OPEN",
  revisionIds: [],
  ...over,
});

export const review = (id: string, at: string, findings: Finding[], over: Partial<Review> = {}): Review => ({
  schemaVersion: 1,
  projectId: "p",
  id,
  createdAt: at,
  reviewer: "Claude Code",
  reviewedRevisionId: null,
  status: "COMPLETE",
  summary: "s",
  strengths: [],
  findings,
  missingInformation: [],
  assessment: { verdict: "READY_FOR_HUDSON", summary: "a" },
  ...over,
});

export const revision = (n: number, at: string, over: Partial<Revision> = {}): Revision => ({
  schemaVersion: 1,
  projectId: "p",
  id: `revision-${String(n).padStart(3, "0")}`,
  number: n,
  createdAt: at,
  summary: "r",
  changes: [],
  filesTouched: [],
  addressedFindingIds: [],
  newFindingIds: [],
  findingUpdates: [],
  screenshotIds: [],
  browserChecks: [{ name: "Home", viewport: "Desktop", result: "PASS" }],
  validation: [{ name: "Build", result: "PASS" }],
  limitations: [],
  ...over,
});

export const approval = (revisionId: string, reviewId: string): Project["approval"] => ({
  approvedAt: "2026-01-10T00:00:00.000Z",
  approvedBy: "Hudson",
  revisionId,
  reviewId,
  rationale: "",
});
