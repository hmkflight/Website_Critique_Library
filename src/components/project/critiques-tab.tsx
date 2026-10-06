"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ImageIcon, Link2 } from "lucide-react";
import type { ProjectBundle } from "@/lib/storage";
import type { FindingState } from "@/lib/derive";
import { CATEGORIES, FINDING_STATUSES, SEVERITIES, type Category, type FindingStatus, type Severity } from "@/lib/schema";
import { CATEGORY_LABEL, FINDING_STATUS_LABEL, SEVERITY_LABEL, formatDate, formatDateTime, revisionLabel } from "@/lib/labels";
import { EmptyState, Eyebrow, SectionTitle, Tag, inputClass } from "../ui";
import { CategoryLabel, SeverityTag, StatusTag, VERDICT } from "./shared";

export function CritiquesTab({ bundle, focusFinding }: { bundle: ProjectBundle; focusFinding: string | null }) {
  const [severity, setSeverity] = useState<Severity | "ALL" | "UNRESOLVED">("ALL");
  const [status, setStatus] = useState<FindingStatus | "ALL">("ALL");
  const [category, setCategory] = useState<Category | "ALL">("ALL");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!focusFinding) return;
    const el = document.getElementById(`finding-${focusFinding}`);
    if (el instanceof HTMLDetailsElement) {
      el.open = true;
      el.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      el.querySelector("summary")?.focus();
    }
  }, [focusFinding]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return bundle.findings.filter((f) => {
      if (severity === "UNRESOLVED") {
        if (f.finding.severity === "KEEP" || !(f.status === "OPEN" || f.status === "IN_PROGRESS")) return false;
      } else if (severity !== "ALL" && f.finding.severity !== severity) return false;
      if (status !== "ALL" && f.status !== status) return false;
      if (category !== "ALL" && f.finding.category !== category) return false;
      if (q && ![f.id, f.finding.title, f.finding.observation, f.finding.location.page].some((s) => s.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [bundle.findings, severity, status, category, query]);

  if (bundle.reviews.length === 0) {
    return (
      <EmptyState title="No critiques yet">
        Claude writes reviews to <code className="font-mono text-xs">projects/{bundle.slug}/reviews/</code>. Press Refresh after a review run.
      </EmptyState>
    );
  }

  const screenshotIds = new Set(bundle.screenshots.map((s) => s.id));

  return (
    <div className="space-y-14">
      <section aria-labelledby="cr-history">
        <Eyebrow>Chronological</Eyebrow>
        <SectionTitle id="cr-history" className="mt-2">Review history</SectionTitle>
        <ol className="mt-6 border-l border-rule-strong">
          {bundle.reviews.map((r) => (
            <li key={r.id} className="relative pb-8 pl-6 last:pb-0">
              <span aria-hidden className="absolute -left-[5px] top-1.5 size-[9px] rounded-full border-2 border-paper bg-ink" />
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs">{r.id}</span>
                <span className="text-xs text-ink-3">{formatDateTime(r.createdAt)}</span>
                <span className="text-xs text-ink-3">· reviewed {revisionLabel(r.reviewedRevisionId)}{r.reviewedCommit ? ` @ ${r.reviewedCommit.slice(0, 7)}` : ""}</span>
                <Tag tone={r.status === "COMPLETE" ? "ok" : "warn"}>{r.status.replace("_", " ")}</Tag>
                <Tag tone={VERDICT[r.assessment.verdict].tone}>{VERDICT[r.assessment.verdict].label}</Tag>
              </div>
              <p className="mt-2 max-w-prose leading-relaxed text-ink">{r.summary}</p>
              <p className="mt-1 text-xs text-ink-3">
                {r.findings.length} finding record{r.findings.length === 1 ? "" : "s"} · {r.strengths.length} strength{r.strengths.length === 1 ? "" : "s"} · by {r.reviewer}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="cr-findings">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow>Latest state per finding ID · duplicates merged</Eyebrow>
            <SectionTitle id="cr-findings" className="mt-2">Findings</SectionTitle>
          </div>
          <p className="text-sm text-ink-3" aria-live="polite">
            {shown.length} of {bundle.findings.length}
          </p>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs text-ink-3">
            Severity
            <select value={severity} onChange={(e) => setSeverity(e.target.value as typeof severity)} className={`${inputClass} mt-1`}>
              <option value="ALL">All</option>
              <option value="UNRESOLVED">Unresolved only</option>
              {SEVERITIES.map((s) => <option key={s} value={s}>{SEVERITY_LABEL[s]}</option>)}
            </select>
          </label>
          <label className="text-xs text-ink-3">
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={`${inputClass} mt-1`}>
              <option value="ALL">All</option>
              {FINDING_STATUSES.map((s) => <option key={s} value={s}>{FINDING_STATUS_LABEL[s]}</option>)}
            </select>
          </label>
          <label className="text-xs text-ink-3">
            Category
            <select value={category} onChange={(e) => setCategory(e.target.value as typeof category)} className={`${inputClass} mt-1`}>
              <option value="ALL">All</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
            </select>
          </label>
          <label className="text-xs text-ink-3">
            Search
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ID, title, page…" className={`${inputClass} mt-1`} />
          </label>
        </div>

        {shown.length === 0 ? (
          <p className="mt-8 text-sm text-ink-3">No findings match these filters.</p>
        ) : (
          <div className="mt-6 divide-y divide-rule border-y border-rule">
            {shown.map((f) => (
              <FindingItem key={f.id} f={f} slug={bundle.slug} screenshotIds={screenshotIds} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function FindingItem({ f, slug, screenshotIds }: { f: FindingState; slug: string; screenshotIds: Set<string> }) {
  const loc = f.finding.location;
  const isKeep = f.finding.severity === "KEEP";
  return (
    <details id={`finding-${f.id}`} className={`group scroll-mt-20 ${isKeep ? "bg-ok-soft/25" : ""}`}>
      <summary className="grid cursor-pointer list-none grid-cols-[auto_1fr_auto] items-start gap-x-4 gap-y-1 px-1 py-4 [&::-webkit-details-marker]:hidden">
        <span className="pt-0.5 font-mono text-xs text-ink-3">{f.id}</span>
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-1.5">
            <SeverityTag severity={f.finding.severity} />
            {!isKeep && <StatusTag status={f.status} />}
            {f.hudsonAcceptance && <Tag tone="note">Hudson accepted</Tag>}
            <CategoryLabel category={f.finding.category} />
          </span>
          <span className="mt-1.5 block font-medium leading-snug">{f.finding.title}</span>
          <span className="mt-0.5 block text-xs text-ink-3">
            {loc.page}
            {loc.section ? ` · ${loc.section}` : ""}
            {loc.viewport ? ` · ${loc.viewport}` : ""}
          </span>
        </span>
        <ChevronDown aria-hidden className="mt-1 size-4 text-ink-3 transition-transform group-open:rotate-180" />
      </summary>
      <div className="grid gap-6 pb-6 pl-1 sm:pl-[4.25rem] lg:grid-cols-2">
        <Block title="Observation">{f.finding.observation}</Block>
        {!isKeep && <Block title="Recommended action">{f.finding.recommendation || "—"}</Block>}
        {f.finding.evidence.length > 0 && (
          <div>
            <h3 className="tag text-ink-3">Evidence</h3>
            <ul className="mt-2 space-y-1.5 text-sm">
              {f.finding.evidence.map((e, i) => (
                <li key={i} className="flex items-start gap-2">
                  {e.kind === "SCREENSHOT" ? <ImageIcon aria-hidden className="mt-0.5 size-4 text-ink-3" /> : <Link2 aria-hidden className="mt-0.5 size-4 text-ink-3" />}
                  <EvidenceRef kind={e.kind} refValue={e.ref} label={e.label} slug={slug} known={screenshotIds.has(e.ref)} />
                </li>
              ))}
            </ul>
          </div>
        )}
        {(f.resolutionNotes || f.hudsonAcceptance) && (
          <div>
            <h3 className="tag text-ink-3">Resolution</h3>
            {f.resolutionNotes && <p className="mt-2 text-sm leading-relaxed">{f.resolutionNotes}</p>}
            {f.hudsonAcceptance && (
              <p className="mt-2 border-l-2 border-note pl-3 text-sm text-note">
                Hudson accepted on {formatDate(f.hudsonAcceptance.acceptedAt)}: {f.hudsonAcceptance.rationale}
              </p>
            )}
          </div>
        )}
        <div className="lg:col-span-2">
          <h3 className="tag text-ink-3">History</h3>
          <ol className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-xs text-ink-2">
            {f.history.map((h, i) => (
              <li key={i}>
                <span className="font-mono">{h.recordId}</span> → {FINDING_STATUS_LABEL[h.status]} <span className="text-ink-3">({formatDate(h.at)})</span>
              </li>
            ))}
          </ol>
          {f.linkedRevisionIds.length > 0 && (
            <p className="mt-2 text-xs text-ink-3">Linked revisions: {f.linkedRevisionIds.map(revisionLabel).join(", ")}</p>
          )}
        </div>
      </div>
    </details>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="tag text-ink-3">{title}</h3>
      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{children}</p>
    </div>
  );
}

function EvidenceRef({ kind, refValue, label, slug, known }: { kind: string; refValue: string; label?: string; slug: string; known: boolean }) {
  const text = label || refValue;
  if (kind === "SCREENSHOT" && known) {
    return (
      <a href={`/api/projects/${slug}/screenshots/${refValue}`} target="_blank" rel="noreferrer" className="underline decoration-rule-strong underline-offset-2 hover:decoration-ink">
        {text}
      </a>
    );
  }
  if (kind === "URL" && /^https?:\/\//.test(refValue)) {
    return (
      <a href={refValue} target="_blank" rel="noreferrer noopener" className="break-all underline decoration-rule-strong underline-offset-2 hover:decoration-ink">
        {text}
      </a>
    );
  }
  return (
    <span className="break-all">
      {text}
      {kind === "SCREENSHOT" && !known && <span className="ml-1 text-xs text-warn">(screenshot not in manifest)</span>}
      {label && label !== refValue && <code className="ml-1 font-mono text-xs text-ink-3">{refValue}</code>}
    </span>
  );
}
