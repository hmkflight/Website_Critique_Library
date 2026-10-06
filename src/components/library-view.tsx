"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertOctagon, ArrowUpRight, FolderOpen, Plus, Search } from "lucide-react";
import type { LibraryEntry, ProjectSummary } from "@/lib/summary";
import { PROJECT_STATUSES, type ProjectStatus } from "@/lib/schema";
import { PROJECT_STATUS_LABEL, READINESS_TONE, relativeTime, revisionLabel } from "@/lib/labels";
import { send } from "@/lib/client";
import { AddProjectDialog } from "./add-project-dialog";
import { RefreshButton } from "./refresh-button";
import { DemoTag, Dot, EmptyState, TONE_TEXT, Tag, buttonClass, inputClass } from "./ui";

type SortKey = "updated" | "name" | "open" | "readiness";
const READINESS_ORDER = { NOT_READY: 0, AWAITING_REVIEW: 1, AWAITING_APPROVAL: 2, CLIENT_READY: 3 } as const;

export function LibraryView({ entries, dataDir, demoAvailable }: { entries: LibraryEntry[]; dataDir: string; demoAvailable: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ProjectStatus | "ALL">("ALL");
  const [sort, setSort] = useState<SortKey>("updated");
  const [adding, setAdding] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);

  const projects = entries.filter((e): e is ProjectSummary => !("broken" in e));
  const broken = entries.filter((e) => "broken" in e);
  const hasDemo = projects.some((p) => p.demo);

  const statusCounts = new Map<ProjectStatus, number>();
  for (const p of projects) statusCounts.set(p.status, (statusCounts.get(p.status) ?? 0) + 1);

  const visible = (() => {
    const q = query.trim().toLowerCase();
    const list = projects.filter(
      (p) =>
        (status === "ALL" || p.status === status) &&
        (!q || [p.name, p.clientName, p.description, p.websiteUrl, p.slug].some((s) => s.toLowerCase().includes(q))),
    );
    list.sort((a, b) => {
      if (a.demo !== b.demo) return a.demo ? 1 : -1;
      switch (sort) {
        case "name":
          return a.name.localeCompare(b.name);
        case "open":
          return b.counts.open + b.counts.inProgress - (a.counts.open + a.counts.inProgress);
        case "readiness":
          return READINESS_ORDER[a.readiness.level] - READINESS_ORDER[b.readiness.level];
        default:
          return b.updatedAt.localeCompare(a.updatedAt);
      }
    });
    return list;
  })();

  async function demo(method: "POST" | "DELETE") {
    setDemoBusy(true);
    setDemoError(null);
    const res = await send("/api/demo", { method });
    setDemoBusy(false);
    if (!res.ok) setDemoError(res.error);
    router.refresh();
  }

  const totalOpen = projects.filter((p) => !p.demo).reduce((n, p) => n + p.counts.open + p.counts.inProgress, 0);
  const awaitingHudson = projects.filter((p) => !p.demo && p.readiness.level === "AWAITING_APPROVAL").length;

  return (
    <div>
      <section className="grid gap-8 border-b border-ink pb-8 pt-12 sm:pt-16 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="tag mb-4 text-ink-3">Post-build critique · revision · approval</p>
          <h1 className="font-display text-5xl leading-[0.95] tracking-[-0.02em] sm:text-7xl">
            The Critique <span className="italic">Library</span>
          </h1>
          <p className="mt-5 max-w-xl text-[0.95rem] leading-relaxed text-ink-2">
            Claude improves before it replaces. Every finding, revision and verification lands here as a file. Nothing is client ready until the evidence holds and Hudson signs off.
          </p>
        </div>
        <dl className="flex gap-8 text-sm lg:gap-10">
          <Stat label="Projects" value={projects.filter((p) => !p.demo).length} />
          <Stat label="Open findings" value={totalOpen} />
          <Stat label="Awaiting Hudson" value={awaitingHudson} />
        </dl>
      </section>

      <div className="sticky top-0 z-10 -mx-5 flex flex-wrap items-center gap-3 border-b border-rule bg-paper/95 px-5 py-3 backdrop-blur sm:-mx-8 sm:px-8">
        <label className="relative min-w-[200px] flex-1">
          <span className="sr-only">Search projects</span>
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, client, URL…" className={`${inputClass} pl-9`} />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-ink-3">Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus | "ALL")} className={`${inputClass} w-auto py-1.5`}>
            <option value="ALL">All ({projects.length})</option>
            {PROJECT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {PROJECT_STATUS_LABEL[s]} ({statusCounts.get(s) ?? 0})
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-ink-3">Sort</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className={`${inputClass} w-auto py-1.5`}>
            <option value="updated">Recently updated</option>
            <option value="name">Name</option>
            <option value="open">Most open findings</option>
            <option value="readiness">Least ready first</option>
          </select>
        </label>
        <div className="flex items-center gap-2">
          <RefreshButton />
          <button type="button" className={buttonClass.primary} onClick={() => setAdding(true)}>
            <Plus aria-hidden className="size-4" /> Add project
          </button>
        </div>
      </div>

      {broken.length > 0 && (
        <section aria-labelledby="broken-title" className="mt-6 border-l-2 border-mark bg-mark-soft/60 px-4 py-3">
          <h2 id="broken-title" className="flex items-center gap-2 text-sm font-semibold text-mark">
            <AlertOctagon aria-hidden className="size-4" /> {broken.length} project folder{broken.length === 1 ? "" : "s"} could not be loaded
          </h2>
          <ul className="mt-2 space-y-1 text-sm text-ink-2">
            {broken.map((b) => (
              <li key={b.slug}>
                <code className="font-mono text-xs">projects/{b.slug}/</code>{" "}
                {"issues" in b && b.issues.map((i) => `${i.file}: ${i.message}`).join(" · ")}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink-2">
            Fix the files, or run <code className="font-mono">npm run validate</code>, then Refresh.
          </p>
        </section>
      )}

      <div aria-live="polite" className="sr-only">
        {visible.length} project{visible.length === 1 ? "" : "s"} shown
      </div>

      {projects.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="No projects yet"
            action={
              <>
                <button type="button" className={buttonClass.primary} onClick={() => setAdding(true)}>
                  <Plus aria-hidden className="size-4" /> Register a website
                </button>
                {demoAvailable && (
                  <button type="button" className={buttonClass.secondary} disabled={demoBusy} onClick={() => demo("POST")}>
                    <FolderOpen aria-hidden className="size-4" /> Load demo project
                  </button>
                )}
              </>
            }
          >
            Register a Codex build to start. Reviews and revisions appear once Claude writes them to{" "}
            <code className="break-all font-mono text-xs">{dataDir}</code>.
          </EmptyState>
        </div>
      ) : visible.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="Nothing matches"
            action={
              <button type="button" className={buttonClass.secondary} onClick={() => { setQuery(""); setStatus("ALL"); }}>
                Clear filters
              </button>
            }
          >
            No project matches “{query || PROJECT_STATUS_LABEL[status as ProjectStatus]}”.
          </EmptyState>
        </div>
      ) : (
        <ol className="divide-y divide-rule">
          {visible.map((p, i) => (
            <ProjectRow key={p.slug} p={p} index={i} />
          ))}
        </ol>
      )}

      {demoError && <p role="alert" className="mt-4 text-sm text-mark">{demoError}</p>}

      <footer className="mt-16 flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-4 text-xs text-ink-3">
        <span>
          Data directory: <code className="break-all font-mono">{dataDir}</code>
        </span>
        {demoAvailable &&
          (hasDemo ? (
            <button type="button" className={buttonClass.ghost} disabled={demoBusy} onClick={() => demo("DELETE")}>
              Remove demo project
            </button>
          ) : (
            projects.length > 0 && (
              <button type="button" className={buttonClass.ghost} disabled={demoBusy} onClick={() => demo("POST")}>
                Load demo project
              </button>
            )
          ))}
      </footer>

      <AddProjectDialog open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="tag text-ink-3">{label}</dt>
      <dd className="mt-1 font-display text-4xl leading-none tabular-nums">{value}</dd>
    </div>
  );
}

function ProjectRow({ p, index }: { p: ProjectSummary; index: number }) {
  const unresolved = p.counts.open + p.counts.inProgress;
  return (
    <li className="group relative grid gap-5 py-7 sm:grid-cols-[minmax(0,240px)_1fr] lg:grid-cols-[260px_1fr_220px] lg:gap-8">
      <div className="relative aspect-[16/10] overflow-hidden rounded-[3px] bg-sheet ring-1 ring-rule">
        {p.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/projects/${p.slug}/screenshots/${p.thumbnail.id}`}
            alt=""
            loading="lazy"
            className="size-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.015]"
          />
        ) : (
          <div className="flex size-full flex-col justify-between p-4">
            <span className="tag text-ink-3">No screenshots yet</span>
            <span className="font-display text-5xl italic leading-none text-rule-strong">{p.name.slice(0, 1)}</span>
          </div>
        )}
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="tag tabular-nums text-ink-3">{String(index + 1).padStart(2, "0")}</span>
          <Tag tone={p.status === "CLIENT_READY" || p.status === "COMPLETE" ? "ok" : "muted"}>{PROJECT_STATUS_LABEL[p.status]}</Tag>
          {p.demo && <DemoTag />}
          {p.issueCount > 0 && <Tag tone="warn">{p.issueCount} file issue{p.issueCount === 1 ? "" : "s"}</Tag>}
        </div>
        <h2 className="mt-3 font-display text-3xl leading-tight tracking-[-0.01em]">
          <Link href={`/projects/${p.slug}`} className="after:absolute after:inset-0 hover:underline hover:decoration-1 hover:underline-offset-4">
            {p.name}
          </Link>
        </h2>
        <p className="mt-1 text-sm text-ink-2">
          {p.clientName} · <span className="text-ink-3">{p.buildOrigin} build</span>
        </p>
        {p.description && <p className="mt-3 line-clamp-2 max-w-prose text-sm leading-relaxed text-ink-2">{p.description}</p>}
        <p className="mt-3 flex items-center gap-1 text-xs text-ink-3">
          {p.websiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}
          <ArrowUpRight aria-hidden className="size-3" />
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:col-span-2 lg:col-span-1">
        <div className={`flex items-start gap-2 border-l-2 border-current pl-3 ${TONE_TEXT[READINESS_TONE[p.readiness.level]]}`}>
          <div>
            <p className="text-sm font-semibold">{p.readiness.label}</p>
            {p.readiness.failing.length > 0 && p.readiness.level !== "AWAITING_REVIEW" && (
              <p className="mt-0.5 text-xs text-ink-2">Missing: {p.readiness.failing.join(", ").toLowerCase()}</p>
            )}
          </div>
        </div>
        <dl className="grid grid-cols-4 gap-2 text-xs lg:grid-cols-2 lg:gap-y-3">
          <Metric label="Revision" value={revisionLabel(p.currentRevisionId)} />
          <Metric label="Updated" value={relativeTime(p.updatedAt)} />
          <Metric
            label="Open"
            value={
              <span className="inline-flex items-center gap-1.5">
                {unresolved > 0 && <Dot tone="mark" />}
                {unresolved}
                {p.counts.unresolvedBlockers > 0 && <span className="text-mark">({p.counts.unresolvedBlockers} blocker)</span>}
              </span>
            }
          />
          <Metric label="Fixed" value={`${p.counts.fixed} / ${p.counts.total}`} />
        </dl>
      </div>
    </li>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="tag text-ink-3">{label}</dt>
      <dd className="mt-1 text-sm tabular-nums text-ink">{value}</dd>
    </div>
  );
}
