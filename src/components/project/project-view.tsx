"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowUpRight, FileWarning, FolderGit2, Globe } from "lucide-react";
import type { ProjectBundle } from "@/lib/storage";
import { PROJECT_STATUS_LABEL, READINESS_TONE, relativeTime, revisionLabel } from "@/lib/labels";
import { pickThumbnail } from "@/lib/thumbnail";
import { RefreshButton } from "../refresh-button";
import { DemoTag, TONE_TEXT, Tag } from "../ui";
import { OverviewTab } from "./overview-tab";
import { CritiquesTab } from "./critiques-tab";
import { RevisionsTab } from "./revisions-tab";
import { VisualsTab } from "./visuals-tab";
import { FinalReviewTab } from "./final-review-tab";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "critiques", label: "Critiques" },
  { id: "revisions", label: "Revisions" },
  { id: "visuals", label: "Visuals" },
  { id: "final", label: "Final review" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export function ProjectView({ bundle }: { bundle: ProjectBundle }) {
  const { project, readiness, counts } = bundle;
  const [tab, setTabState] = useState<TabId>("overview");
  const [focusFinding, setFocusFinding] = useState<string | null>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync from URL once on mount
    if (t && TABS.some((x) => x.id === t)) setTabState(t as TabId);
  }, []);

  const setTab = useCallback((id: TabId) => {
    setTabState(id);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", id);
    window.history.replaceState(null, "", url);
  }, []);

  const openFinding = useCallback(
    (id: string) => {
      setFocusFinding(id);
      setTab("critiques");
    },
    [setTab],
  );

  function onTabKey(e: React.KeyboardEvent, i: number) {
    let next = -1;
    if (e.key === "ArrowRight") next = (i + 1) % TABS.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = TABS.length - 1;
    if (next < 0) return;
    e.preventDefault();
    setTab(TABS[next].id);
    tabRefs.current[TABS[next].id]?.focus();
  }

  const hero = pickThumbnail(bundle);
  const unresolved = counts.open + counts.inProgress;
  const badge: Partial<Record<TabId, string>> = {
    critiques: unresolved ? String(unresolved) : undefined,
    revisions: bundle.revisions.length ? String(bundle.revisions.length) : undefined,
    visuals: bundle.screenshots.length ? String(bundle.screenshots.length) : undefined,
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 pt-6">
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-ink-2 hover:text-ink">
          <ArrowLeft aria-hidden className="size-4" /> Library
        </Link>
        <RefreshButton />
      </div>

      <header className="grid gap-8 border-b border-ink pb-8 pt-8 lg:grid-cols-[1fr_minmax(0,440px)] lg:items-end">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Tag tone={project.status === "CLIENT_READY" || project.status === "COMPLETE" ? "ok" : "muted"}>
              Status · {PROJECT_STATUS_LABEL[project.status]}
            </Tag>
            {project.demo && <DemoTag />}
          </div>
          <h1 className="mt-4 font-display text-5xl leading-[0.98] tracking-[-0.02em] sm:text-6xl">{project.name}</h1>
          <p className="mt-3 text-ink-2">
            {project.clientName} · {project.buildOrigin} build · registered {relativeTime(project.createdAt)}
          </p>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <a href={project.websiteUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1.5 underline decoration-rule-strong underline-offset-4 hover:decoration-ink">
              <Globe aria-hidden className="size-4" /> {project.websiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}
              <ArrowUpRight aria-hidden className="size-3" />
            </a>
            {project.repositoryUrl && (
              <a href={project.repositoryUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1.5 underline decoration-rule-strong underline-offset-4 hover:decoration-ink">
                <FolderGit2 aria-hidden className="size-4" /> Repository <ArrowUpRight aria-hidden className="size-3" />
              </a>
            )}
          </div>

          <div className={`mt-8 flex flex-wrap items-baseline gap-x-6 gap-y-3 border-l-2 border-current pl-4 ${TONE_TEXT[READINESS_TONE[readiness.level]]}`}>
            <p className="font-display text-2xl italic">{readiness.label}</p>
            <p className="text-sm text-ink-2">
              {revisionLabel(bundle.currentRevisionId)} · {unresolved} open · {counts.fixed} fixed
              {counts.unresolvedBlockers > 0 && <span className="text-mark"> · {counts.unresolvedBlockers} blocker{counts.unresolvedBlockers === 1 ? "" : "s"}</span>}
            </p>
          </div>
        </div>
        {hero && (
          <figure className="overflow-hidden rounded-[3px] bg-sheet ring-1 ring-rule">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/projects/${bundle.slug}/screenshots/${hero.id}`}
              alt={`${hero.page} at ${hero.viewport.label}, ${hero.role.toLowerCase()}`}
              width={hero.image?.width}
              height={hero.image?.height}
              className="max-h-[300px] w-full object-cover object-top"
            />
            <figcaption className="tag flex justify-between border-t border-rule px-3 py-2 text-ink-3">
              <span>{hero.page} · {hero.viewport.label}</span>
              <span>{hero.demoVisual ? "Demo visual" : hero.role}</span>
            </figcaption>
          </figure>
        )}
      </header>

      {bundle.issues.length > 0 && (
        <section aria-label="File issues" className="mt-6 border-l-2 border-warn bg-warn-soft/60 px-4 py-3 text-sm">
          <p className="flex items-center gap-2 font-semibold text-warn">
            <FileWarning aria-hidden className="size-4" /> {bundle.issues.length} file issue{bundle.issues.length === 1 ? "" : "s"}. Affected records are skipped until fixed.
          </p>
          <ul className="mt-2 space-y-1 text-ink-2">
            {bundle.issues.map((i, n) => (
              <li key={n}>
                <code className="font-mono text-xs">{i.file}</code>: {i.message}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div role="tablist" aria-label="Project sections" className="sticky top-0 z-10 -mx-5 mt-2 flex gap-1 overflow-x-auto border-b border-rule bg-paper/95 px-5 backdrop-blur sm:-mx-8 sm:px-8">
        {TABS.map((t, i) => {
          const selected = tab === t.id;
          return (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[t.id] = el;
              }}
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setTab(t.id)}
              onKeyDown={(e) => onTabKey(e, i)}
              className={`relative -mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3.5 text-sm transition-colors ${
                selected ? "border-ink font-semibold text-ink" : "border-transparent text-ink-2 hover:text-ink"
              }`}
            >
              {t.label}
              {badge[t.id] && <span className="tag rounded-full bg-rule/70 px-1.5 py-0.5 text-ink-2">{badge[t.id]}</span>}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} tabIndex={0} className="pt-8 focus-visible:outline-offset-8">
        {tab === "overview" && <OverviewTab bundle={bundle} onOpenFinding={openFinding} onGoto={setTab} />}
        {tab === "critiques" && <CritiquesTab bundle={bundle} focusFinding={focusFinding} />}
        {tab === "revisions" && <RevisionsTab bundle={bundle} onOpenFinding={openFinding} />}
        {tab === "visuals" && <VisualsTab bundle={bundle} />}
        {tab === "final" && <FinalReviewTab bundle={bundle} onOpenFinding={openFinding} />}
      </div>
    </div>
  );
}

export type GotoTab = (id: TabId) => void;
