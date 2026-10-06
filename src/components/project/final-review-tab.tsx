"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Eye, Pencil, ShieldAlert } from "lucide-react";
import type { NoteKind, ProjectBundle } from "@/lib/storage";
import type { FindingState } from "@/lib/derive";
import { latestReview } from "@/lib/derive";
import { PROJECT_STATUSES, type ProjectStatus } from "@/lib/schema";
import { PROJECT_STATUS_LABEL, READINESS_TONE, formatDateTime, revisionLabel } from "@/lib/labels";
import { send } from "@/lib/client";
import { CheckIcon, Eyebrow, Markdown, SectionTitle, TONE_TEXT, Tag, buttonClass, inputClass, labelClass } from "../ui";
import { FindingLink, SeverityTag, StatusTag, VERDICT } from "./shared";

export function FinalReviewTab({ bundle, onOpenFinding }: { bundle: ProjectBundle; onOpenFinding: (id: string) => void }) {
  const { readiness } = bundle;
  const review = latestReview(bundle.reviews);
  const open = bundle.findings.filter((f) => f.finding.severity !== "KEEP" && (f.status === "OPEN" || f.status === "IN_PROGRESS"));
  const parked = bundle.findings.filter((f) => f.finding.severity !== "KEEP" && (f.status === "DEFERRED" || f.status === "ACCEPTED"));
  const majorsNeedingDecision = bundle.findings.filter((f) => f.finding.severity === "MAJOR" && f.status !== "FIXED");

  return (
    <div className="space-y-14">
      <section aria-labelledby="fr-readiness" className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <Eyebrow>Evidence-based readiness</Eyebrow>
          <h2 id="fr-readiness" className={`mt-2 font-display text-5xl italic leading-none ${TONE_TEXT[READINESS_TONE[readiness.level]]}`}>
            {readiness.label}
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-ink-2">
            Computed from the records, not from the status label. Client ready requires a complete review, passing verification on the current revision, no unfixed blockers, every major fixed or accepted by Hudson, and Hudson’s approval of this exact revision.
          </p>
        </div>
        <ul className="divide-y divide-rule border-y border-rule">
          {readiness.checks.map((c) => (
            <li key={c.id} className="flex gap-3 py-2.5 text-sm">
              <span className="mt-0.5"><CheckIcon state={c.state} /></span>
              <span>
                <span className="font-medium">{c.label}</span>
                <span className="block text-ink-2">{c.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="fr-open">
        <SectionTitle id="fr-open">Unresolved ({open.length})</SectionTitle>
        {open.length === 0 ? (
          <p className="mt-3 text-sm text-ink-3">No open or in-progress findings.</p>
        ) : (
          <FindingList findings={open} onOpenFinding={onOpenFinding} />
        )}
        {parked.length > 0 && (
          <>
            <h3 className="mt-8 font-display text-lg">Deferred and accepted ({parked.length}). Still visible to the client conversation.</h3>
            <FindingList findings={parked} onOpenFinding={onOpenFinding} />
          </>
        )}
      </section>

      {majorsNeedingDecision.length > 0 && (
        <section aria-labelledby="fr-accept">
          <Eyebrow>Hudson decision</Eyebrow>
          <SectionTitle id="fr-accept" className="mt-2">Accept major findings with rationale</SectionTitle>
          <p className="mt-2 max-w-prose text-sm text-ink-2">
            A major finding stops blocking readiness only when it is fixed, or when you accept it here with a reason. Claude marking it “accepted” is not enough.
          </p>
          <ul className="mt-5 space-y-5">
            {majorsNeedingDecision.map((f) => (
              <AcceptanceRow key={f.id} f={f} bundle={bundle} onOpenFinding={onOpenFinding} />
            ))}
          </ul>
        </section>
      )}

      {review && (
        <section aria-labelledby="fr-claude" className="border-t border-rule pt-8">
          <Eyebrow>Claude’s assessment · {review.id}</Eyebrow>
          <div className="mt-3 flex items-center gap-2">
            <Tag tone={VERDICT[review.assessment.verdict].tone}>{VERDICT[review.assessment.verdict].label}</Tag>
          </div>
          <p id="fr-claude" className="mt-3 max-w-prose font-display text-xl leading-snug">{review.assessment.summary}</p>
          <p className="mt-2 text-xs text-ink-3">Advisory only. It never substitutes for Hudson’s approval.</p>
        </section>
      )}

      <div className="grid gap-10 lg:grid-cols-2">
        <NoteEditor bundle={bundle} kind="hudson" title="Hudson’s notes" hint="Private review notes. Stored in notes/hudson.md." />
        <NoteEditor bundle={bundle} kind="client-feedback" title="Client feedback" hint="What the client said. Stored in notes/client-feedback.md." />
      </div>

      <div className="grid gap-10 border-t border-ink pt-10 lg:grid-cols-2">
        <StatusEditor key={bundle.projectVersion} bundle={bundle} />
        <ApprovalPanel bundle={bundle} />
      </div>
    </div>
  );
}

function FindingList({ findings, onOpenFinding }: { findings: FindingState[]; onOpenFinding: (id: string) => void }) {
  return (
    <ul className="mt-4 divide-y divide-rule border-y border-rule">
      {findings.map((f) => (
        <li key={f.id} className="grid grid-cols-[4rem_1fr] gap-3 py-3 sm:grid-cols-[4rem_1fr_auto]">
          <FindingLink id={f.id} onOpen={onOpenFinding} />
          <div className="min-w-0">
            <p className="font-medium leading-snug">{f.finding.title}</p>
            <p className="text-xs text-ink-3">
              {f.finding.location.page}
              {f.finding.location.viewport ? ` · ${f.finding.location.viewport}` : ""}
            </p>
            {f.hudsonAcceptance && <p className="mt-1 text-xs text-note">Hudson: {f.hudsonAcceptance.rationale}</p>}
            {!f.hudsonAcceptance && f.resolutionNotes && <p className="mt-1 text-xs text-ink-2">{f.resolutionNotes}</p>}
          </div>
          <div className="col-start-2 flex flex-wrap gap-1.5 sm:col-start-auto">
            <SeverityTag severity={f.finding.severity} />
            <StatusTag status={f.status} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function useMutation() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; conflict: boolean } | null>(null);
  async function run(url: string, init: Parameters<typeof send>[1]) {
    setBusy(true);
    setError(null);
    const res = await send(url, init);
    setBusy(false);
    if (!res.ok) {
      setError({ message: res.error, conflict: res.status === 409 });
      return false;
    }
    router.refresh();
    return true;
  }
  const errorView = error && (
    <div role="alert" className="mt-3 text-sm text-mark">
      {error.message}{" "}
      {error.conflict && (
        <button type="button" className="underline underline-offset-2" onClick={() => router.refresh()}>
          Reload latest
        </button>
      )}
    </div>
  );
  return { run, busy, errorView, clearError: () => setError(null) };
}

function AcceptanceRow({ f, bundle, onOpenFinding }: { f: FindingState; bundle: ProjectBundle; onOpenFinding: (id: string) => void }) {
  const [rationale, setRationale] = useState(f.hudsonAcceptance?.rationale ?? "");
  const { run, busy, errorView } = useMutation();
  const save = (value: string) =>
    run(`/api/projects/${bundle.slug}/acceptances`, { method: "POST", json: { baseVersion: bundle.projectVersion, findingId: f.id, rationale: value } });
  return (
    <li className="border-l-2 border-rule-strong pl-4">
      <div className="flex flex-wrap items-center gap-2">
        <FindingLink id={f.id} onOpen={onOpenFinding} />
        <StatusTag status={f.status} />
        {f.hudsonAcceptance && <Tag tone="note">Accepted by Hudson</Tag>}
      </div>
      <p className="mt-1 font-medium">{f.finding.title}</p>
      <label htmlFor={`acc-${f.id}`} className="sr-only">Rationale for accepting {f.id}</label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input id={`acc-${f.id}`} value={rationale} onChange={(e) => setRationale(e.target.value)} placeholder="Why this is acceptable for launch…" className={inputClass} />
        <button type="button" className={buttonClass.secondary} disabled={busy || !rationale.trim()} onClick={() => save(rationale)}>
          {f.hudsonAcceptance ? "Update" : "Accept"}
        </button>
        {f.hudsonAcceptance && (
          <button type="button" className={buttonClass.ghost} disabled={busy} onClick={() => save("").then((ok) => ok && setRationale(""))}>
            Withdraw
          </button>
        )}
      </div>
      {errorView}
    </li>
  );
}

function NoteEditor({ bundle, kind, title, hint }: { bundle: ProjectBundle; kind: NoteKind; title: string; hint: string }) {
  const note = bundle.notes[kind];
  const [draft, setDraft] = useState(note.value);
  const [base, setBase] = useState({ value: note.value, version: note.version });
  const [editing, setEditing] = useState(note.value === "");
  const [saved, setSaved] = useState(false);
  const { run, busy, errorView } = useMutation();

  // Adopt externally changed notes when there are no local edits.
  if (note.version !== base.version && draft === base.value) {
    setBase({ value: note.value, version: note.version });
    setDraft(note.value);
  }
  const dirty = draft !== base.value;
  const id = `note-${kind}`;

  async function save() {
    const ok = await run(`/api/projects/${bundle.slug}/notes/${kind}`, { method: "PUT", json: { baseVersion: base.version, content: draft } });
    if (ok) {
      setSaved(true);
      setEditing(false);
    }
  }

  return (
    <section aria-labelledby={`${id}-title`} className="flex flex-col">
      <div className="flex items-center justify-between gap-2">
        <h2 id={`${id}-title`} className="font-display text-2xl">{title}</h2>
        <button type="button" className={buttonClass.ghost} onClick={() => setEditing((v) => !v)} aria-pressed={editing}>
          {editing ? <><Eye aria-hidden className="size-4" /> Preview</> : <><Pencil aria-hidden className="size-4" /> Edit</>}
        </button>
      </div>
      <p className="mt-1 text-xs text-ink-3">{hint} Markdown supported.</p>
      <div className="mt-3 flex-1">
        {editing ? (
          <>
            <label htmlFor={id} className="sr-only">{title}</label>
            <textarea
              id={id}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setSaved(false);
              }}
              rows={10}
              className={`${inputClass} font-mono text-[0.8125rem] leading-relaxed`}
            />
          </>
        ) : (
          <div className="min-h-[10rem] rounded-[4px] border border-rule bg-sheet px-4 py-3">
            {draft.trim() ? <Markdown>{draft}</Markdown> : <p className="text-sm italic text-ink-3">Nothing written yet.</p>}
          </div>
        )}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button type="button" className={buttonClass.primary} disabled={!dirty || busy} onClick={save}>
          {busy ? "Saving…" : "Save"}
        </button>
        {dirty && <span className="text-xs text-warn">Unsaved changes</span>}
        {!dirty && saved && <span className="text-xs text-ok" role="status">Saved to disk</span>}
      </div>
      {errorView}
    </section>
  );
}

function StatusEditor({ bundle }: { bundle: ProjectBundle }) {
  const [status, setStatus] = useState<ProjectStatus>(bundle.project.status);
  const { run, busy, errorView } = useMutation();
  const blocked = status === "CLIENT_READY" && !bundle.readiness.canMarkClientReady;
  return (
    <section aria-labelledby="fr-status">
      <Eyebrow>Workflow label</Eyebrow>
      <h2 id="fr-status" className="mt-2 font-display text-2xl">Project status</h2>
      <p className="mt-1 max-w-md text-sm text-ink-2">A label for where the work is. It is not proof of verification. Client ready is only allowed when the evidence above passes.</p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <label htmlFor="status" className="sr-only">Project status</label>
        <select id="status" value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)} className={inputClass}>
          {PROJECT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {PROJECT_STATUS_LABEL[s]}
              {s === "CLIENT_READY" && !bundle.readiness.canMarkClientReady ? " (requires evidence + approval)" : ""}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={buttonClass.primary}
          disabled={busy || status === bundle.project.status || blocked}
          onClick={() => run(`/api/projects/${bundle.slug}`, { method: "PATCH", json: { baseVersion: bundle.projectVersion, status } })}
        >
          Update status
        </button>
      </div>
      {blocked && (
        <p className="mt-2 text-sm text-mark">
          Not yet: {bundle.readiness.checks.filter((c) => c.state === "fail").map((c) => c.label.toLowerCase()).join(", ")}.
        </p>
      )}
      <p className="mt-2 text-xs text-ink-3">Last updated {formatDateTime(bundle.project.updatedAt)}</p>
      {errorView}
    </section>
  );
}

function ApprovalPanel({ bundle }: { bundle: ProjectBundle }) {
  const { readiness, project } = bundle;
  const [rationale, setRationale] = useState("");
  const { run, busy, errorView } = useMutation();
  const approval = project.approval;
  const act = (action: "approve" | "revoke") =>
    run(`/api/projects/${bundle.slug}/approval`, { method: "POST", json: { baseVersion: bundle.projectVersion, action, rationale } });

  return (
    <section aria-labelledby="fr-approval" className={`rounded-[4px] p-5 ring-1 ${readiness.approvalValid ? "bg-ok-soft/50 ring-ok/30" : "bg-sheet ring-rule"}`}>
      <Eyebrow>Explicit sign-off</Eyebrow>
      <h2 id="fr-approval" className="mt-2 font-display text-2xl">Hudson approval</h2>

      {readiness.approvalValid && approval ? (
        <div className="mt-3">
          <p className="flex items-center gap-2 font-medium text-ok">
            <BadgeCheck aria-hidden className="size-5" /> Approved {revisionLabel(approval.revisionId)} ({approval.reviewId})
          </p>
          <p className="mt-1 text-sm text-ink-2">{formatDateTime(approval.approvedAt)} by {approval.approvedBy}</p>
          {approval.rationale && <p className="mt-2 text-sm">{approval.rationale}</p>}
          <button type="button" className={`${buttonClass.secondary} mt-4`} disabled={busy} onClick={() => act("revoke")}>
            Revoke approval
          </button>
        </div>
      ) : (
        <div className="mt-3">
          {readiness.approvalStale && approval && (
            <p className="mb-3 flex gap-2 text-sm text-mark">
              <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              Earlier approval of {revisionLabel(approval.revisionId)} / {approval.reviewId} no longer applies. Newer records exist.
            </p>
          )}
          <p className="text-sm text-ink-2">
            Approving records that you reviewed <strong>{revisionLabel(bundle.currentRevisionId)}</strong> against <strong>{bundle.latestReviewId ?? "no review"}</strong>. Any later revision or review clears it.
          </p>
          <label htmlFor="approval-rationale" className={`${labelClass} mt-4`}>Note (optional)</label>
          <textarea id="approval-rationale" rows={2} value={rationale} onChange={(e) => setRationale(e.target.value)} className={inputClass} />
          <button type="button" className={`${buttonClass.primary} mt-3`} disabled={busy || !readiness.evidenceReady} onClick={() => act("approve")}>
            <BadgeCheck aria-hidden className="size-4" /> Approve {revisionLabel(bundle.currentRevisionId)}
          </button>
          {!readiness.evidenceReady && (
            <p className="mt-2 text-sm text-ink-2">Available once the evidence checks pass: {readiness.checks.filter((c) => c.state === "fail" && c.id !== "approval").map((c) => c.label.toLowerCase()).join(", ")}.</p>
          )}
        </div>
      )}
      {errorView}
    </section>
  );
}
