"use client";

import { ArrowRight } from "lucide-react";
import type { ProjectBundle } from "@/lib/storage";
import { formatDate, revisionLabel } from "@/lib/labels";
import { latestReview } from "@/lib/derive";
import { CheckIcon, EmptyState, Eyebrow, SectionTitle, Tag } from "../ui";
import type { GotoTab } from "./project-view";
import { VERDICT } from "./shared";

export function OverviewTab({ bundle, onOpenFinding, onGoto }: { bundle: ProjectBundle; onOpenFinding: (id: string) => void; onGoto: GotoTab }) {
  const { project, readiness, counts } = bundle;
  const review = latestReview(bundle.reviews);
  const keeps = bundle.findings.filter((f) => f.finding.severity === "KEEP");

  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-12">
        <section aria-labelledby="ov-context">
          <Eyebrow>Context</Eyebrow>
          <SectionTitle id="ov-context" className="mt-2">What this build is for</SectionTitle>
          <p className="mt-4 max-w-prose whitespace-pre-line leading-relaxed text-ink-2">
            {project.description || "No description yet. Add the brief from the master prompt so reviews can be judged against intent."}
          </p>
        </section>

        {!review ? (
          <EmptyState title="Claude hasn't reviewed this build yet">
            Run the review prompt from <code className="font-mono text-xs">docs/CLAUDE_REVIEW_PROMPT.md</code> in Claude Code against this project, then press Refresh.
          </EmptyState>
        ) : (
          <>
            <section aria-labelledby="ov-assessment">
              <Eyebrow>Claude’s latest assessment · {review.id} · {formatDate(review.createdAt)}</Eyebrow>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Tag tone={VERDICT[review.assessment.verdict].tone}>{VERDICT[review.assessment.verdict].label}</Tag>
                {review.status !== "COMPLETE" && <Tag tone="warn">Review {review.status.replace("_", " ").toLowerCase()}</Tag>}
              </div>
              <blockquote id="ov-assessment" className="mt-4 max-w-prose border-l-2 border-ink pl-5 font-display text-xl leading-snug text-ink">
                {review.assessment.summary}
              </blockquote>
              <p className="mt-3 max-w-prose text-xs text-ink-3">Claude’s assessment informs Hudson’s decision. It is not an approval.</p>
            </section>

            <section aria-labelledby="ov-strengths">
              <Eyebrow>Improve before replacing</Eyebrow>
              <SectionTitle id="ov-strengths" className="mt-2">Strengths to preserve</SectionTitle>
              {review.strengths.length === 0 && keeps.length === 0 ? (
                <p className="mt-4 text-sm text-ink-3">The latest review records no strengths. The protocol asks Claude to document these first.</p>
              ) : (
                <ol className="mt-5 grid gap-x-8 gap-y-6 sm:grid-cols-2">
                  {review.strengths.map((s, i) => (
                    <li key={i} className="border-t border-rule pt-3">
                      <p className="font-medium">{s.title}</p>
                      {s.detail && <p className="mt-1 text-sm leading-relaxed text-ink-2">{s.detail}</p>}
                    </li>
                  ))}
                  {keeps.map((k) => (
                    <li key={k.id} className="border-t border-ok/40 pt-3">
                      <button type="button" onClick={() => onOpenFinding(k.id)} className="text-left">
                        <span className="flex items-center gap-2">
                          <Tag tone="ok">Keep · {k.id}</Tag>
                        </span>
                        <span className="mt-2 block font-medium hover:underline">{k.finding.title}</span>
                      </button>
                      <p className="mt-1 text-sm leading-relaxed text-ink-2">{k.finding.observation}</p>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            {review.missingInformation.length > 0 && (
              <section aria-labelledby="ov-missing">
                <SectionTitle id="ov-missing">Missing information</SectionTitle>
                <ul className="mt-4 max-w-prose list-disc space-y-1.5 pl-5 text-sm text-ink-2">
                  {review.missingInformation.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>

      <aside className="space-y-8 lg:border-l lg:border-rule lg:pl-8">
        <section aria-labelledby="ov-record">
          <h2 id="ov-record" className="tag text-ink-3">Record</h2>
          <dl className="mt-3 divide-y divide-rule border-y border-rule text-sm">
            <Row k="Current revision" v={revisionLabel(bundle.currentRevisionId)} />
            <Row k="Latest review" v={review ? `${review.id} (${review.status.toLowerCase().replace("_", " ")})` : "None"} />
            <Row k="Reviews / revisions" v={`${bundle.reviews.length} / ${bundle.revisions.length}`} />
            <Row k="Findings" v={`${counts.total} tracked · ${counts.keep} keep`} />
            <Row k="Open · fixed" v={`${counts.open + counts.inProgress} · ${counts.fixed}`} />
            <Row k="Accepted · deferred" v={`${counts.accepted} · ${counts.deferred}`} />
          </dl>
        </section>

        <section aria-labelledby="ov-refs">
          <h2 id="ov-refs" className="tag text-ink-3">References</h2>
          <dl className="mt-3 space-y-3 text-sm">
            <Ref k="Website" v={project.websiteUrl} href={project.websiteUrl} />
            {project.repositoryUrl && <Ref k="Repository" v={project.repositoryUrl} href={project.repositoryUrl} />}
            {project.localPath && <Ref k="Local path" v={project.localPath} mono />}
            <Ref k="Library folder" v={`projects/${project.id}/`} mono />
          </dl>
        </section>

        <section aria-labelledby="ov-ready">
          <h2 id="ov-ready" className="tag text-ink-3">Readiness evidence</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {readiness.checks.map((c) => (
              <li key={c.id} className="flex gap-2">
                <span className="mt-0.5"><CheckIcon state={c.state} /></span>
                <span>
                  <span className="font-medium">{c.label}.</span> <span className="text-ink-2">{c.detail}</span>
                </span>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => onGoto("final")} className="mt-4 inline-flex items-center gap-1 text-sm font-medium underline underline-offset-4">
            Open final review <ArrowRight aria-hidden className="size-4" />
          </button>
        </section>
      </aside>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 py-2">
      <dt className="text-ink-3">{k}</dt>
      <dd className="text-right tabular-nums">{v}</dd>
    </div>
  );
}

function Ref({ k, v, href, mono }: { k: string; v: string; href?: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-ink-3">{k}</dt>
      <dd className={`mt-0.5 break-all ${mono ? "font-mono text-xs" : ""}`}>
        {href ? (
          <a href={href} target="_blank" rel="noreferrer noopener" className="underline decoration-rule-strong underline-offset-4 hover:decoration-ink">
            {v}
          </a>
        ) : (
          v
        )}
      </dd>
    </div>
  );
}
