import { describe, expect, it } from "vitest";
import { computeReadiness, countFindings, currentRevision, deriveFindings } from "../src/lib/derive";
import { approval, finding, review, revision } from "./fixtures";

const T = (d: number) => `2026-01-0${d}T00:00:00.000Z`;

describe("finding derivation", () => {
  it("merges repeated finding IDs across reviews using the latest state", () => {
    const r1 = review("review-001", T(1), [finding("F-001"), finding("F-002", { severity: "MAJOR" })]);
    const r2 = review("review-002", T(3), [finding("F-001", { status: "FIXED", title: "Renamed" })]);
    const { findings } = deriveFindings([r2, r1], []);
    expect(findings.map((f) => f.id).sort()).toEqual(["F-001", "F-002"]);
    const f1 = findings.find((f) => f.id === "F-001")!;
    expect(f1.status).toBe("FIXED");
    expect(f1.finding.title).toBe("Renamed");
    expect(f1.firstReviewId).toBe("review-001");
    expect(f1.history).toHaveLength(2);
  });

  it("applies revision finding updates in time order and links revisions", () => {
    const r1 = review("review-001", T(1), [finding("F-001")]);
    const rev = revision(1, T(2), { addressedFindingIds: ["F-001"], findingUpdates: [{ findingId: "F-001", status: "FIXED" }] });
    const { findings } = deriveFindings([r1], [rev]);
    expect(findings[0].status).toBe("FIXED");
    expect(findings[0].linkedRevisionIds).toEqual(["revision-001"]);
  });

  it("a later review overrides an earlier revision update", () => {
    const r1 = review("review-001", T(1), [finding("F-001")]);
    const rev = revision(1, T(2), { findingUpdates: [{ findingId: "F-001", status: "FIXED" }] });
    const r2 = review("review-002", T(3), [finding("F-001", { status: "OPEN" })]);
    expect(deriveFindings([r1, r2], [rev]).findings[0].status).toBe("OPEN");
  });

  it("reports updates to unknown findings instead of inventing them", () => {
    const rev = revision(1, T(2), { findingUpdates: [{ findingId: "F-009", status: "FIXED" }] });
    const { findings, issues } = deriveFindings([], [rev]);
    expect(findings).toHaveLength(0);
    expect(issues[0].message).toMatch(/F-009/);
  });

  it("KEEP never counts as a defect", () => {
    const { findings } = deriveFindings([review("review-001", T(1), [finding("F-001", { severity: "KEEP" }), finding("F-002")])], []);
    const c = countFindings(findings);
    expect(c.keep).toBe(1);
    expect(c.total).toBe(1);
    expect(c.open).toBe(1);
  });

  it("current revision is the highest number", () => {
    expect(currentRevision([revision(2, T(1)), revision(1, T(2))])!.id).toBe("revision-002");
  });
});

describe("readiness", () => {
  const base = () => {
    const reviews = [review("review-001", T(1), [finding("F-001", { severity: "MINOR" })])];
    const revisions = [revision(1, T(2))];
    return { reviews, revisions };
  };
  const run = (reviews: ReturnType<typeof base>["reviews"], revisions: ReturnType<typeof base>["revisions"], appr: ReturnType<typeof approval> = null, acceptances: { findingId: string; rationale: string; acceptedAt: string }[] = []) => {
    const { findings } = deriveFindings(reviews, revisions, { hudsonAcceptances: acceptances });
    return computeReadiness({ approval: appr }, reviews, revisions, findings);
  };

  it("awaits review when none exists", () => {
    expect(run([], []).level).toBe("AWAITING_REVIEW");
  });

  it("is client ready only with evidence and matching approval", () => {
    const { reviews, revisions } = base();
    expect(run(reviews, revisions).level).toBe("AWAITING_APPROVAL");
    const r = run(reviews, revisions, approval("revision-001", "review-001"));
    expect(r.level).toBe("CLIENT_READY");
    expect(r.canMarkClientReady).toBe(true);
  });

  it("unresolved blocker prevents readiness, even when deferred or accepted", () => {
    for (const status of ["OPEN", "DEFERRED", "ACCEPTED"] as const) {
      const reviews = [review("review-001", T(1), [finding("F-001", { severity: "BLOCKER", status })])];
      const r = run(reviews, [revision(1, T(2))], approval("revision-001", "review-001"));
      expect(r.level).toBe("NOT_READY");
      expect(r.checks.find((c) => c.id === "blockers")!.state).toBe("fail");
    }
  });

  it("major needs FIXED or Hudson acceptance with rationale; Claude ACCEPTED is not enough", () => {
    const reviews = [review("review-001", T(1), [finding("F-001", { severity: "MAJOR", status: "ACCEPTED" })])];
    const revisions = [revision(1, T(2))];
    expect(run(reviews, revisions).evidenceReady).toBe(false);
    expect(run(reviews, revisions, null, [{ findingId: "F-001", rationale: "  ", acceptedAt: T(3) }]).evidenceReady).toBe(false);
    expect(run(reviews, revisions, null, [{ findingId: "F-001", rationale: "Client approved copy as-is", acceptedAt: T(3) }]).evidenceReady).toBe(true);
  });

  it("requires a complete review", () => {
    const reviews = [review("review-001", T(1), [], { status: "IN_PROGRESS" })];
    expect(run(reviews, [revision(1, T(2))], approval("revision-001", "review-001")).level).toBe("NOT_READY");
  });

  it("requires successful verification on the current revision", () => {
    const { reviews } = base();
    expect(run(reviews, []).evidenceReady).toBe(false);
    const failing = revision(1, T(2), { validation: [{ name: "Build", result: "FAIL" }] });
    expect(run(reviews, [failing]).evidenceReady).toBe(false);
    const noBrowser = revision(1, T(2), { browserChecks: [{ name: "Home", result: "NOT_RUN" }] });
    expect(run(reviews, [noBrowser]).evidenceReady).toBe(false);
  });

  it("a later revision or review invalidates earlier approval", () => {
    const { reviews, revisions } = base();
    const appr = approval("revision-001", "review-001");
    const laterRev = run(reviews, [...revisions, revision(2, T(3))], appr);
    expect(laterRev.approvalStale).toBe(true);
    expect(laterRev.level).toBe("AWAITING_APPROVAL");
    const laterReview = run([...reviews, review("review-002", T(4), [])], revisions, appr);
    expect(laterReview.approvalStale).toBe(true);
    expect(laterReview.canMarkClientReady).toBe(false);
  });

  it("open minor findings warn but do not block", () => {
    const { reviews, revisions } = base();
    const r = run(reviews, revisions, approval("revision-001", "review-001"));
    expect(r.checks.find((c) => c.id === "minor")!.state).toBe("warn");
    expect(r.level).toBe("CLIENT_READY");
  });
});
