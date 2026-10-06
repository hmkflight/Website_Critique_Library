"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Columns2, ImagePlus, Layers, SplitSquareHorizontal } from "lucide-react";
import type { ProjectBundle } from "@/lib/storage";
import type { Screenshot } from "@/lib/schema";
import { formatDateTime, revisionLabel } from "@/lib/labels";
import { EmptyState, Eyebrow, Tag, buttonClass, inputClass } from "../ui";
import { UploadScreenshotDialog } from "./upload-screenshot-dialog";

interface Pair {
  pairId: string;
  page: string;
  viewport: string;
  befores: Screenshot[];
  afters: Screenshot[];
}

type Mode = "side" | "slider" | "toggle";

export function buildPairs(shots: Screenshot[]): Pair[] {
  const map = new Map<string, Pair>();
  for (const s of shots) {
    const p = map.get(s.pairId) ?? { pairId: s.pairId, page: s.page, viewport: s.viewport.label, befores: [], afters: [] };
    (s.role === "BEFORE" ? p.befores : p.afters).push(s);
    map.set(s.pairId, p);
  }
  return [...map.values()];
}

/** Explicit differences between two captures that make comparison unreliable. */
export function mismatches(a: Screenshot, b: Screenshot): string[] {
  const out: string[] = [];
  if (a.page !== b.page) out.push(`Different pages: ${a.page} vs ${b.page}`);
  if (a.viewport.width !== b.viewport.width || a.viewport.height !== b.viewport.height) {
    out.push(`Viewport ${a.viewport.width}×${a.viewport.height} vs ${b.viewport.width}×${b.viewport.height}`);
  }
  if (a.image && b.image) {
    const ra = a.image.width / a.image.height;
    const rb = b.image.width / b.image.height;
    if (Math.abs(ra - rb) / ra > 0.02) out.push(`Image proportions differ (${a.image.width}×${a.image.height} vs ${b.image.width}×${b.image.height})`);
  }
  return out;
}

export function VisualsTab({ bundle }: { bundle: ProjectBundle }) {
  const pairs = useMemo(() => buildPairs(bundle.screenshots), [bundle.screenshots]);
  const [uploading, setUploading] = useState(false);
  const [pageFilter, setPageFilter] = useState("ALL");
  const [vpFilter, setVpFilter] = useState("ALL");
  const [revFilter, setRevFilter] = useState("LATEST");
  const [mode, setMode] = useState<Mode>("side");
  const [selected, setSelected] = useState<string | null>(null);

  const pages = [...new Set(pairs.map((p) => p.page))];
  const viewports = [...new Set(pairs.map((p) => p.viewport))];
  const revisionsWithShots = [...new Set(bundle.screenshots.map((s) => s.revisionId).filter(Boolean))] as string[];

  const shown = pairs.filter((p) => (pageFilter === "ALL" || p.page === pageFilter) && (vpFilter === "ALL" || p.viewport === vpFilter));
  const active = shown.find((p) => p.pairId === selected) ?? shown[0];

  const upload = (
    <button type="button" className={buttonClass.secondary} onClick={() => setUploading(true)}>
      <ImagePlus aria-hidden className="size-4" /> Import screenshot
    </button>
  );

  return (
    <div>
      {pairs.length === 0 ? (
        <EmptyState title="No screenshots yet" action={upload}>
          Claude captures before/after screenshots during review. You can also import captures here with page, viewport and revision details.
        </EmptyState>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-ink-3">
              Page
              <select value={pageFilter} onChange={(e) => setPageFilter(e.target.value)} className={`${inputClass} mt-1 w-auto`}>
                <option value="ALL">All pages</option>
                {pages.map((p) => <option key={p}>{p}</option>)}
              </select>
            </label>
            <label className="text-xs text-ink-3">
              Viewport
              <select value={vpFilter} onChange={(e) => setVpFilter(e.target.value)} className={`${inputClass} mt-1 w-auto`}>
                <option value="ALL">All viewports</option>
                {viewports.map((v) => <option key={v}>{v}</option>)}
              </select>
            </label>
            <label className="text-xs text-ink-3">
              After capture from
              <select value={revFilter} onChange={(e) => setRevFilter(e.target.value)} className={`${inputClass} mt-1 w-auto`}>
                <option value="LATEST">Latest available</option>
                {revisionsWithShots.map((r) => <option key={r} value={r}>{revisionLabel(r)}</option>)}
              </select>
            </label>
            <div role="group" aria-label="Comparison mode" className="flex rounded-[4px] border border-rule-strong bg-sheet p-0.5">
              {([
                ["side", "Side by side", Columns2],
                ["slider", "Slider", SplitSquareHorizontal],
                ["toggle", "Toggle", Layers],
              ] as const).map(([m, label, Icon]) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={mode === m}
                  onClick={() => setMode(m)}
                  className={`inline-flex items-center gap-1.5 rounded-[3px] px-2.5 py-1.5 text-sm ${mode === m ? "bg-ink text-paper" : "text-ink-2 hover:text-ink"}`}
                >
                  <Icon aria-hidden className="size-4" /> {label}
                </button>
              ))}
            </div>
            <div className="ml-auto">{upload}</div>
          </div>

          <div className="mt-8 grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
            <nav aria-label="Captured views">
              <Eyebrow>Views ({shown.length})</Eyebrow>
              <ul className="mt-3 divide-y divide-rule border-y border-rule">
                {shown.map((p) => {
                  const missing = p.befores.length === 0 ? "No before" : p.afters.length === 0 ? "No after" : null;
                  const isActive = active?.pairId === p.pairId;
                  return (
                    <li key={p.pairId}>
                      <button
                        type="button"
                        aria-current={isActive ? "true" : undefined}
                        onClick={() => setSelected(p.pairId)}
                        className={`flex w-full items-start justify-between gap-2 px-2 py-2.5 text-left text-sm ${isActive ? "bg-sheet font-medium" : "hover:bg-sheet/60"}`}
                      >
                        <span>
                          {p.page}
                          <span className="block text-xs font-normal text-ink-3">{p.viewport}</span>
                        </span>
                        {missing && <Tag tone="warn">{missing}</Tag>}
                      </button>
                    </li>
                  );
                })}
              </ul>
              {shown.length === 0 && <p className="mt-3 text-sm text-ink-3">No views match.</p>}
            </nav>

            {active && <Comparison key={active.pairId + revFilter} pair={active} slug={bundle.slug} mode={mode} revFilter={revFilter} />}
          </div>
        </>
      )}
      <UploadScreenshotDialog open={uploading} onClose={() => setUploading(false)} bundle={bundle} pairs={pairs.map((p) => ({ pairId: p.pairId, page: p.page, viewport: p.viewport }))} />
    </div>
  );
}

function Comparison({ pair, slug, mode, revFilter }: { pair: Pair; slug: string; mode: Mode; revFilter: string }) {
  const before = pair.befores.at(-1) ?? null;
  const afterCandidates = revFilter === "LATEST" ? pair.afters : pair.afters.filter((a) => a.revisionId === revFilter);
  const after = afterCandidates.at(-1) ?? null;
  const [pos, setPos] = useState(50);
  const [showAfter, setShowAfter] = useState(true);

  const problems = before && after ? mismatches(before, after) : [];
  const missing = !before ? "No before capture exists for this view." : !after ? (revFilter === "LATEST" ? "No after capture exists for this view." : `No after capture from ${revisionLabel(revFilter)} for this view.`) : null;
  const demo = before?.demoVisual || after?.demoVisual;

  return (
    <section aria-label={`${pair.page} at ${pair.viewport}`} className="min-w-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-2xl">
          {pair.page} <span className="italic text-ink-3">at {pair.viewport}</span>
        </h2>
        {demo && <Tag tone="ink">Demo visuals · illustrative only</Tag>}
      </div>

      {(missing || problems.length > 0) && (
        <div role="note" className="mt-4 flex gap-2 border-l-2 border-warn bg-warn-soft/60 px-3 py-2 text-sm text-warn">
          <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
          <div>
            {missing && <p className="font-medium">Missing pair. {missing}</p>}
            {problems.length > 0 && (
              <>
                <p className="font-medium">Mismatched captures. Compare with care.</p>
                <ul className="mt-1 list-disc pl-5 text-ink-2">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
              </>
            )}
          </div>
        </div>
      )}

      <div className="mt-5">
        {mode === "side" || !before || !after ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Shot shot={before} slug={slug} role="Before" />
            <Shot shot={after} slug={slug} role="After" />
          </div>
        ) : mode === "slider" ? (
          <div>
            <div className="relative overflow-hidden rounded-[3px] bg-sheet ring-1 ring-rule">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src(slug, before)} alt={alt(before)} width={before.image?.width} height={before.image?.height} className="block h-auto w-full" />
              <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src(slug, after)} alt={alt(after)} width={after.image?.width} height={after.image?.height} className="block h-auto w-full" />
              </div>
              <div aria-hidden className="pointer-events-none absolute inset-y-0 w-px bg-mark" style={{ left: `${pos}%` }} />
              <span className="tag absolute left-2 top-2 rounded bg-ink/80 px-1.5 py-1 text-paper">Before</span>
              <span className="tag absolute right-2 top-2 rounded bg-ink/80 px-1.5 py-1 text-paper">After</span>
            </div>
            <label className="mt-3 flex items-center gap-3 text-sm text-ink-2">
              <span className="shrink-0">Before</span>
              <input
                type="range"
                min={0}
                max={100}
                value={pos}
                onChange={(e) => setPos(Number(e.target.value))}
                aria-label="Comparison divider position"
                aria-valuetext={`${100 - pos}% after visible`}
                className="w-full accent-[#b2321a]"
              />
              <span className="shrink-0">After</span>
            </label>
            <Meta before={before} after={after} />
          </div>
        ) : (
          <div>
            <button type="button" aria-pressed={showAfter} onClick={() => setShowAfter((v) => !v)} className={buttonClass.secondary}>
              Showing {showAfter ? "after" : "before"}. Switch to {showAfter ? "before" : "after"}.
            </button>
            <div className="mt-3" aria-live="polite">
              <Shot shot={showAfter ? after : before} slug={slug} role={showAfter ? "After" : "Before"} />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

const src = (slug: string, s: Screenshot) => `/api/projects/${slug}/screenshots/${s.id}`;
const alt = (s: Screenshot) => `${s.role === "BEFORE" ? "Before" : "After"}: ${s.page} at ${s.viewport.label}${s.caption ? `. ${s.caption}` : ""}`;

function Shot({ shot, slug, role }: { shot: Screenshot | null; slug: string; role: string }) {
  if (!shot) {
    return (
      <figure className="flex aspect-[4/3] items-center justify-center rounded-[3px] border border-dashed border-rule-strong text-sm text-ink-3">
        No {role.toLowerCase()} capture
      </figure>
    );
  }
  return (
    <figure>
      <div className="overflow-hidden rounded-[3px] bg-sheet ring-1 ring-rule">
        <a href={src(slug, shot)} target="_blank" rel="noreferrer" aria-label={`Open full-size ${role.toLowerCase()} image`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src(slug, shot)} alt={alt(shot)} width={shot.image?.width} height={shot.image?.height} loading="lazy" className="block h-auto w-full" />
        </a>
      </div>
      <figcaption className="mt-2 text-xs text-ink-3">
        <span className="tag mr-2 text-ink">{role}</span>
        {shot.viewport.width}×{shot.viewport.height} · {formatDateTime(shot.capturedAt)}
        {shot.revisionId ? ` · ${revisionLabel(shot.revisionId)}` : shot.reviewId ? ` · ${shot.reviewId}` : ""}
        {shot.caption && <span className="block text-ink-2">{shot.caption}</span>}
      </figcaption>
    </figure>
  );
}

function Meta({ before, after }: { before: Screenshot; after: Screenshot }) {
  return (
    <p className="mt-2 text-xs text-ink-3">
      Before: {before.viewport.width}×{before.viewport.height}, {formatDateTime(before.capturedAt)} · After: {after.viewport.width}×{after.viewport.height},{" "}
      {formatDateTime(after.capturedAt)}
      {after.revisionId ? ` (${revisionLabel(after.revisionId)})` : ""}
    </p>
  );
}
