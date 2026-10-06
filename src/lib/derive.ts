/**
 * Pure derivations over loaded records: finding state across history,
 * counts, current revision and evidence-based readiness. No filesystem
 * access here so it can be unit-tested directly.
 */
import type {
  Finding,
  FindingStatus,
  Project,
  Review,
  Revision,
  Severity,
} from "./schema";

export interface FindingEvent {
  source: "review" | "revision";
  recordId: string;
  at: string;
  status: FindingStatus;
  resolutionNotes?: string;
}

export interface FindingState {
  id: string;
  /** Latest full record of the finding as Claude last wrote it in a review. */
  finding: Finding;
  status: FindingStatus;
  resolutionNotes?: string;
  firstReviewId: string;
  lastReviewId: string;
  linkedRevisionIds: string[];
  history: FindingEvent[];
  hudsonAcceptance?: { rationale: string; acceptedAt: string };
}

export interface DeriveIssue {
  file: string;
  message: string;
}

const byTimeThenId = (a: { createdAt: string; id: string }, b: { createdAt: string; id: string }) =>
  a.createdAt === b.createdAt ? a.id.localeCompare(b.id) : a.createdAt.localeCompare(b.createdAt);

export function sortReviews(reviews: Review[]): Review[] {
  return [...reviews].sort(byTimeThenId);
}

export function sortRevisions(revisions: Revision[]): Revision[] {
  return [...revisions].sort((a, b) => a.number - b.number || byTimeThenId(a, b));
}

export function latestReview(reviews: Review[]): Review | null {
  const sorted = sortReviews(reviews);
  return sorted.at(-1) ?? null;
}

export function currentRevision(revisions: Revision[]): Revision | null {
  return sortRevisions(revisions).at(-1) ?? null;
}

/**
 * Replays reviews and revisions in time order. A finding ID repeated in
 * several reviews is one finding; the most recent record wins.
 */
export function deriveFindings(
  reviews: Review[],
  revisions: Revision[],
  project?: Pick<Project, "hudsonAcceptances">,
): { findings: FindingState[]; issues: DeriveIssue[] } {
  type Ev =
    | { kind: "review"; at: string; id: string; review: Review }
    | { kind: "revision"; at: string; id: string; revision: Revision };
  const events: Ev[] = [
    ...reviews.map((review) => ({ kind: "review" as const, at: review.createdAt, id: review.id, review })),
    ...revisions.map((revision) => ({ kind: "revision" as const, at: revision.createdAt, id: revision.id, revision })),
  ].sort((a, b) => (a.at === b.at ? (a.kind === b.kind ? a.id.localeCompare(b.id) : a.kind === "review" ? -1 : 1) : a.at.localeCompare(b.at)));

  const states = new Map<string, FindingState>();
  const issues: DeriveIssue[] = [];

  for (const ev of events) {
    if (ev.kind === "review") {
      const seen = new Set<string>();
      for (const f of ev.review.findings) {
        if (seen.has(f.id)) {
          issues.push({ file: `reviews/${ev.id}.json`, message: `Finding ${f.id} appears twice in this review; the later entry was used.` });
        }
        seen.add(f.id);
        const prev = states.get(f.id);
        const event: FindingEvent = { source: "review", recordId: ev.id, at: ev.at, status: f.status, resolutionNotes: f.resolutionNotes };
        states.set(f.id, {
          id: f.id,
          finding: f,
          status: f.status,
          resolutionNotes: f.resolutionNotes ?? prev?.resolutionNotes,
          firstReviewId: prev?.firstReviewId ?? ev.id,
          lastReviewId: ev.id,
          linkedRevisionIds: unique([...(prev?.linkedRevisionIds ?? []), ...f.revisionIds]),
          history: [...(prev?.history ?? []), event],
        });
      }
    } else {
      const r = ev.revision;
      for (const id of unique([...r.addressedFindingIds, ...r.changes.flatMap((c) => c.findingIds)])) {
        const s = states.get(id);
        if (s) s.linkedRevisionIds = unique([...s.linkedRevisionIds, r.id]);
        else issues.push({ file: `revisions/${r.id}.json`, message: `References finding ${id}, which no earlier review defines.` });
      }
      for (const u of r.findingUpdates) {
        const s = states.get(u.findingId);
        if (!s) {
          issues.push({ file: `revisions/${r.id}.json`, message: `Updates finding ${u.findingId}, which no earlier review defines.` });
          continue;
        }
        s.status = u.status;
        if (u.resolutionNotes) s.resolutionNotes = u.resolutionNotes;
        s.linkedRevisionIds = unique([...s.linkedRevisionIds, r.id]);
        s.history.push({ source: "revision", recordId: r.id, at: r.createdAt, status: u.status, resolutionNotes: u.resolutionNotes });
      }
    }
  }

  const acceptances = new Map((project?.hudsonAcceptances ?? []).map((a) => [a.findingId, a]));
  const findings = [...states.values()].map((s) => {
    const a = acceptances.get(s.id);
    return a ? { ...s, hudsonAcceptance: { rationale: a.rationale, acceptedAt: a.acceptedAt } } : s;
  });
  findings.sort((a, b) => severityRank(a.finding.severity) - severityRank(b.finding.severity) || a.id.localeCompare(b.id));
  return { findings, issues };
}

export const SEVERITY_ORDER: Severity[] = ["BLOCKER", "MAJOR", "MODERATE", "MINOR", "KEEP"];
export const severityRank = (s: Severity) => SEVERITY_ORDER.indexOf(s);

export function isUnresolved(s: FindingState): boolean {
  return s.finding.severity !== "KEEP" && (s.status === "OPEN" || s.status === "IN_PROGRESS");
}

export interface FindingCounts {
  total: number;
  open: number;
  inProgress: number;
  fixed: number;
  accepted: number;
  deferred: number;
  keep: number;
  unresolvedBlockers: number;
  unresolvedMajors: number;
}

/** KEEP records are preserved strengths and never count as defects. */
export function countFindings(findings: FindingState[]): FindingCounts {
  const c: FindingCounts = { total: 0, open: 0, inProgress: 0, fixed: 0, accepted: 0, deferred: 0, keep: 0, unresolvedBlockers: 0, unresolvedMajors: 0 };
  for (const f of findings) {
    if (f.finding.severity === "KEEP") {
      c.keep++;
      continue;
    }
    c.total++;
    if (f.status === "OPEN") c.open++;
    else if (f.status === "IN_PROGRESS") c.inProgress++;
    else if (f.status === "FIXED") c.fixed++;
    else if (f.status === "ACCEPTED") c.accepted++;
    else if (f.status === "DEFERRED") c.deferred++;
    if (f.finding.severity === "BLOCKER" && f.status !== "FIXED") c.unresolvedBlockers++;
    if (f.finding.severity === "MAJOR" && majorBlocks(f)) c.unresolvedMajors++;
  }
  return c;
}

/** MAJOR needs FIXED, or Hudson's explicit acceptance with a rationale. */
function majorBlocks(f: FindingState): boolean {
  return f.status !== "FIXED" && !f.hudsonAcceptance?.rationale.trim();
}

// ---------------------------------------------------------------- Readiness

export type CheckState = "pass" | "fail" | "warn";

export interface ReadinessCheck {
  id: string;
  label: string;
  state: CheckState;
  detail: string;
}

export type ReadinessLevel = "AWAITING_REVIEW" | "NOT_READY" | "AWAITING_APPROVAL" | "CLIENT_READY";

export interface Readiness {
  level: ReadinessLevel;
  label: string;
  checks: ReadinessCheck[];
  /** Evidence gates passed; only Hudson's approval is missing or stale. */
  evidenceReady: boolean;
  approvalValid: boolean;
  approvalStale: boolean;
  canMarkClientReady: boolean;
}

export const READINESS_LABEL: Record<ReadinessLevel, string> = {
  AWAITING_REVIEW: "Awaiting Claude review",
  NOT_READY: "Not ready",
  AWAITING_APPROVAL: "Ready for Hudson approval",
  CLIENT_READY: "Client ready",
};

export function computeReadiness(
  project: Pick<Project, "approval">,
  reviews: Review[],
  revisions: Revision[],
  findings: FindingState[],
): Readiness {
  const checks: ReadinessCheck[] = [];
  const review = latestReview(reviews);
  const revision = currentRevision(revisions);
  const counts = countFindings(findings);

  // 1. Completed review
  if (!review) {
    checks.push({ id: "review", label: "Claude review", state: "fail", detail: "No review has been recorded." });
  } else if (review.status !== "COMPLETE") {
    checks.push({ id: "review", label: "Claude review", state: "fail", detail: `Latest review ${review.id} is ${review.status.replace("_", " ").toLowerCase()}.` });
  } else {
    checks.push({ id: "review", label: "Claude review", state: "pass", detail: `${review.id} is complete.` });
  }
  if (review && review.missingInformation.length > 0) {
    checks.push({ id: "missing-info", label: "Missing information", state: "warn", detail: `${review.missingInformation.length} item${plural(review.missingInformation.length)} Claude could not confirm.` });
  }

  // 2. Verification on the current revision
  if (!revision) {
    checks.push({ id: "verification", label: "Verification", state: "fail", detail: "No revision with verification evidence has been recorded." });
  } else {
    const all = [...revision.browserChecks, ...revision.validation];
    const failed = all.filter((c) => c.result === "FAIL");
    const passedBrowser = revision.browserChecks.filter((c) => c.result === "PASS");
    const skipped = all.filter((c) => c.result === "NOT_RUN" || c.result === "UNAVAILABLE");
    if (failed.length > 0) {
      checks.push({ id: "verification", label: "Verification", state: "fail", detail: `${failed.length} check${plural(failed.length)} failed on ${revision.id}.` });
    } else if (passedBrowser.length === 0) {
      checks.push({ id: "verification", label: "Verification", state: "fail", detail: `${revision.id} records no passing browser check.` });
    } else {
      checks.push({ id: "verification", label: "Verification", state: "pass", detail: `${passedBrowser.length} browser check${plural(passedBrowser.length)} passed on ${revision.id}.` });
    }
    if (skipped.length > 0) {
      checks.push({ id: "verification-gaps", label: "Verification gaps", state: "warn", detail: `${skipped.length} check${plural(skipped.length)} not run or unavailable.` });
    }
  }

  // 3. Findings
  checks.push(
    counts.unresolvedBlockers > 0
      ? { id: "blockers", label: "Blockers", state: "fail", detail: `${counts.unresolvedBlockers} blocker${plural(counts.unresolvedBlockers)} not fixed.` }
      : { id: "blockers", label: "Blockers", state: "pass", detail: "No unresolved blockers." },
  );
  checks.push(
    counts.unresolvedMajors > 0
      ? { id: "majors", label: "Major findings", state: "fail", detail: `${counts.unresolvedMajors} major finding${plural(counts.unresolvedMajors)} neither fixed nor accepted by Hudson.` }
      : { id: "majors", label: "Major findings", state: "pass", detail: "All major findings fixed or accepted by Hudson." },
  );
  const minorOpen = findings.filter((f) => isUnresolved(f) && (f.finding.severity === "MODERATE" || f.finding.severity === "MINOR")).length;
  if (minorOpen > 0) {
    checks.push({ id: "minor", label: "Moderate / minor", state: "warn", detail: `${minorOpen} still open. Does not block readiness.` });
  }
  if (counts.deferred + counts.accepted > 0) {
    checks.push({ id: "deferred", label: "Deferred / accepted", state: "warn", detail: `${counts.deferred} deferred, ${counts.accepted} accepted. Remain visible to the client.` });
  }

  const evidenceReady = checks.every((c) => c.state !== "fail");

  // 4. Hudson approval of the current revision
  const approval = project.approval;
  const approvalValid = !!approval && !!revision && !!review && approval.revisionId === revision.id && approval.reviewId === review.id;
  const approvalStale = !!approval && !approvalValid;
  if (approvalValid) {
    checks.push({ id: "approval", label: "Hudson approval", state: "pass", detail: `Approved ${revision!.id} on ${approval!.approvedAt.slice(0, 10)}.` });
  } else if (approvalStale) {
    checks.push({ id: "approval", label: "Hudson approval", state: "fail", detail: `Approval covered ${approval!.revisionId} / ${approval!.reviewId}; newer records exist. Re-approve.` });
  } else {
    checks.push({ id: "approval", label: "Hudson approval", state: "fail", detail: "Not yet approved by Hudson." });
  }

  const level: ReadinessLevel = !review
    ? "AWAITING_REVIEW"
    : !evidenceReady
      ? "NOT_READY"
      : approvalValid
        ? "CLIENT_READY"
        : "AWAITING_APPROVAL";

  return {
    level,
    label: READINESS_LABEL[level],
    checks,
    evidenceReady,
    approvalValid,
    approvalStale,
    canMarkClientReady: level === "CLIENT_READY",
  };
}

function unique<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}

function plural(n: number) {
  return n === 1 ? "" : "s";
}
