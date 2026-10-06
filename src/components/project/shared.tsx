"use client";

import type { Check } from "@/lib/schema";
import { CATEGORY_LABEL, CHECK_RESULT_LABEL, CHECK_TONE, FINDING_STATUS_LABEL, FINDING_STATUS_TONE, SEVERITY_LABEL, SEVERITY_TONE, type Tone } from "@/lib/labels";
import type { FindingState } from "@/lib/derive";
import { Tag } from "../ui";

export const VERDICT: Record<string, { label: string; tone: Tone }> = {
  READY_FOR_HUDSON: { label: "Claude: ready for Hudson", tone: "note" },
  NEEDS_REVISION: { label: "Claude: needs revision", tone: "warn" },
  BLOCKED: { label: "Claude: blocked", tone: "mark" },
};

export function SeverityTag({ severity }: { severity: FindingState["finding"]["severity"] }) {
  return <Tag tone={SEVERITY_TONE[severity]}>{SEVERITY_LABEL[severity]}</Tag>;
}

export function StatusTag({ status }: { status: FindingState["status"] }) {
  return <Tag tone={FINDING_STATUS_TONE[status]}>{FINDING_STATUS_LABEL[status]}</Tag>;
}

export function CategoryLabel({ category }: { category: FindingState["finding"]["category"] }) {
  return <span className="tag text-ink-3">{CATEGORY_LABEL[category]}</span>;
}

export function FindingLink({ id, onOpen }: { id: string; onOpen?: (id: string) => void }) {
  if (!onOpen) return <code className="font-mono text-xs">{id}</code>;
  return (
    <button type="button" onClick={() => onOpen(id)} className="font-mono text-xs underline decoration-rule-strong underline-offset-2 hover:decoration-ink">
      {id}
    </button>
  );
}

export function ChecksTable({ checks, caption }: { checks: Check[]; caption: string }) {
  if (checks.length === 0) {
    return <p className="text-sm text-mark">No {caption.toLowerCase()} recorded.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-rule text-xs text-ink-3">
            <th scope="col" className="py-2 pr-3 font-medium">Check</th>
            <th scope="col" className="py-2 pr-3 font-medium">Viewport / command</th>
            <th scope="col" className="py-2 pr-3 font-medium">Result</th>
            <th scope="col" className="py-2 font-medium">Notes</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-rule">
          {checks.map((c, i) => (
            <tr key={i} className="align-top">
              <td className="py-2 pr-3">{c.name}</td>
              <td className="py-2 pr-3 font-mono text-xs text-ink-2">{c.viewport ?? c.command ?? "—"}</td>
              <td className="py-2 pr-3">
                <Tag tone={CHECK_TONE[c.result]}>{CHECK_RESULT_LABEL[c.result]}</Tag>
              </td>
              <td className="py-2 text-ink-2">{c.notes ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
