"use client";

import { FileCode2, GitCommitHorizontal } from "lucide-react";
import type { ProjectBundle } from "@/lib/storage";
import { FINDING_STATUS_LABEL, formatDateTime } from "@/lib/labels";
import { EmptyState, Eyebrow, Tag } from "../ui";
import { ChecksTable, FindingLink } from "./shared";

export function RevisionsTab({ bundle, onOpenFinding }: { bundle: ProjectBundle; onOpenFinding: (id: string) => void }) {
  if (bundle.revisions.length === 0) {
    return (
      <EmptyState title="No revisions recorded">
        Each Claude change pass writes <code className="font-mono text-xs">revisions/revision-NNN.json</code> with what changed and how it was verified.
      </EmptyState>
    );
  }
  const current = bundle.currentRevisionId;
  return (
    <ol className="space-y-16">
      {bundle.revisions.map((r) => {
        const failed = [...r.browserChecks, ...r.validation].filter((c) => c.result === "FAIL").length;
        return (
          <li key={r.id} aria-labelledby={`rev-${r.id}`} className="grid gap-8 lg:grid-cols-[200px_minmax(0,1fr)]">
            <div className="lg:sticky lg:top-20 lg:self-start">
              <p id={`rev-${r.id}`} className="font-display text-6xl leading-none tabular-nums">
                {String(r.number).padStart(2, "0")}
              </p>
              <p className="mt-2 font-mono text-xs text-ink-3">{r.id}</p>
              <p className="mt-1 text-xs text-ink-3">{formatDateTime(r.createdAt)}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {r.id === current && <Tag tone="ink">Current</Tag>}
                {failed > 0 ? <Tag tone="mark">{failed} failed</Tag> : <Tag tone="ok">No failures</Tag>}
              </div>
              {r.commit && (
                <p className="mt-3 flex items-center gap-1 font-mono text-xs text-ink-2">
                  <GitCommitHorizontal aria-hidden className="size-4" /> {r.commit.slice(0, 10)}
                </p>
              )}
            </div>

            <div className="min-w-0 space-y-8 border-t border-ink pt-4">
              <p className="max-w-prose font-display text-xl leading-snug">{r.summary}</p>

              {r.changes.length > 0 && (
                <section>
                  <Eyebrow>Exact changes</Eyebrow>
                  <ol className="mt-3 space-y-3">
                    {r.changes.map((c, i) => (
                      <li key={i} className="grid grid-cols-[1.5rem_1fr] gap-2 text-sm leading-relaxed">
                        <span className="font-mono text-xs text-ink-3">{i + 1}.</span>
                        <span>
                          {c.description}
                          {c.findingIds.length > 0 && (
                            <span className="ml-2 inline-flex flex-wrap gap-1.5 align-baseline">
                              {c.findingIds.map((id) => <FindingLink key={id} id={id} onOpen={onOpenFinding} />)}
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              <div className="grid gap-8 sm:grid-cols-2">
                <section>
                  <Eyebrow>Findings addressed</Eyebrow>
                  {r.addressedFindingIds.length === 0 ? (
                    <p className="mt-2 text-sm text-ink-3">None listed.</p>
                  ) : (
                    <ul className="mt-2 space-y-1 text-sm">
                      {r.addressedFindingIds.map((id) => {
                        const upd = r.findingUpdates.find((u) => u.findingId === id);
                        return (
                          <li key={id}>
                            <FindingLink id={id} onOpen={onOpenFinding} />
                            {upd && <span className="ml-2 text-ink-2">→ {FINDING_STATUS_LABEL[upd.status]}</span>}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {r.newFindingIds.length > 0 && (
                    <p className="mt-3 text-sm">
                      <span className="text-ink-3">New findings discovered: </span>
                      {r.newFindingIds.map((id, i) => (
                        <span key={id}>
                          {i > 0 && ", "}
                          <FindingLink id={id} onOpen={onOpenFinding} />
                        </span>
                      ))}
                    </p>
                  )}
                </section>
                <section>
                  <Eyebrow>Files touched ({r.filesTouched.length})</Eyebrow>
                  <ul className="mt-2 space-y-1">
                    {r.filesTouched.map((f) => (
                      <li key={f} className="flex items-center gap-1.5 font-mono text-xs text-ink-2">
                        <FileCode2 aria-hidden className="size-3.5 shrink-0 text-ink-3" />
                        <span className="break-all">{f}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>

              <section>
                <Eyebrow>Browser checks</Eyebrow>
                <div className="mt-2"><ChecksTable checks={r.browserChecks} caption="Browser checks" /></div>
              </section>
              <section>
                <Eyebrow>Validation</Eyebrow>
                <div className="mt-2"><ChecksTable checks={r.validation} caption="Validation results" /></div>
              </section>

              <section>
                <Eyebrow>Remaining limitations</Eyebrow>
                {r.limitations.length === 0 ? (
                  <p className="mt-2 text-sm text-ink-3">None recorded.</p>
                ) : (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-2">
                    {r.limitations.map((l, i) => <li key={i}>{l}</li>)}
                  </ul>
                )}
              </section>

              {r.screenshotIds.length > 0 && (
                <p className="text-xs text-ink-3">{r.screenshotIds.length} screenshot{r.screenshotIds.length === 1 ? "" : "s"} attached. See Visuals.</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
