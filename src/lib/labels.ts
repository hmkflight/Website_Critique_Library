import type { Category, CheckResult, FindingStatus, ProjectStatus, Severity } from "./schema";
import type { ReadinessLevel } from "./derive";

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  AWAITING_CLAUDE_REVIEW: "Awaiting Claude review",
  CLAUDE_REVIEWING: "Claude reviewing",
  REVISION_IN_PROGRESS: "Revision in progress",
  AWAITING_HUDSON_REVIEW: "Awaiting Hudson review",
  CLIENT_READY: "Client ready",
  CLIENT_FEEDBACK: "Client feedback",
  COMPLETE: "Complete",
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  BLOCKER: "Blocker",
  MAJOR: "Major",
  MODERATE: "Moderate",
  MINOR: "Minor",
  KEEP: "Keep",
};

export const FINDING_STATUS_LABEL: Record<FindingStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  FIXED: "Fixed",
  ACCEPTED: "Accepted",
  DEFERRED: "Deferred",
};

export const CATEGORY_LABEL: Record<Category, string> = {
  VISUAL: "Visual",
  TYPOGRAPHY: "Typography",
  COLOR: "Color",
  COMPOSITION: "Composition",
  MOTION: "Motion",
  CONTENT: "Content",
  CLIENT_SPECIFICITY: "Client specificity",
  UX: "UX",
  RESPONSIVE: "Responsive",
  ACCESSIBILITY: "Accessibility",
  FUNCTIONAL: "Functional",
  PERFORMANCE: "Performance",
  OTHER: "Other",
};

export const CHECK_RESULT_LABEL: Record<CheckResult, string> = {
  PASS: "Pass",
  FAIL: "Fail",
  NOT_RUN: "Not run",
  UNAVAILABLE: "Unavailable",
};

export const READINESS_TONE: Record<ReadinessLevel, Tone> = {
  AWAITING_REVIEW: "muted",
  NOT_READY: "mark",
  AWAITING_APPROVAL: "note",
  CLIENT_READY: "ok",
};

export type Tone = "mark" | "warn" | "ok" | "note" | "muted" | "ink";

export const SEVERITY_TONE: Record<Severity, Tone> = {
  BLOCKER: "mark",
  MAJOR: "mark",
  MODERATE: "warn",
  MINOR: "muted",
  KEEP: "ok",
};

export const FINDING_STATUS_TONE: Record<FindingStatus, Tone> = {
  OPEN: "mark",
  IN_PROGRESS: "warn",
  FIXED: "ok",
  ACCEPTED: "note",
  DEFERRED: "muted",
};

export const CHECK_TONE: Record<CheckResult, Tone> = {
  PASS: "ok",
  FAIL: "mark",
  NOT_RUN: "warn",
  UNAVAILABLE: "warn",
};

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export function relativeTime(iso: string, now = Date.now()): string {
  const diff = Math.round((now - new Date(iso).getTime()) / 1000);
  const abs = Math.abs(diff);
  if (abs < 60) return "just now";
  const units: [number, string][] = [[60, "minute"], [3600, "hour"], [86400, "day"], [604800, "week"]];
  for (let i = units.length - 1; i >= 0; i--) {
    const [secs, name] = units[i];
    if (abs >= secs) {
      if (name === "week" && abs >= 604800 * 5) return formatDate(iso);
      const n = Math.floor(abs / secs);
      return `${n} ${name}${n === 1 ? "" : "s"} ago`;
    }
  }
  return formatDate(iso);
}

export function revisionLabel(id: string | null): string {
  if (!id) return "Original build";
  return `Rev ${Number(id.replace("revision-", ""))}`;
}
