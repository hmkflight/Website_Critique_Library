import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import { AlertTriangle, Check, Circle, X } from "lucide-react";
import type { Tone } from "@/lib/labels";

const TONE_CLASS: Record<Tone, string> = {
  mark: "bg-mark-soft text-mark ring-mark/25",
  warn: "bg-warn-soft text-warn ring-warn/25",
  ok: "bg-ok-soft text-ok ring-ok/25",
  note: "bg-note-soft text-note ring-note/25",
  muted: "bg-paper text-ink-2 ring-rule-strong",
  ink: "bg-ink text-paper ring-ink",
};

export const TONE_TEXT: Record<Tone, string> = {
  mark: "text-mark",
  warn: "text-warn",
  ok: "text-ok",
  note: "text-note",
  muted: "text-ink-3",
  ink: "text-ink",
};

export function Tag({ tone = "muted", children, className = "" }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={`tag inline-flex items-center gap-1 whitespace-nowrap rounded-[3px] px-1.5 py-1 ring-1 ring-inset ${TONE_CLASS[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function DemoTag() {
  return (
    <Tag tone="ink" className="!tracking-[0.12em]">
      Demo · not a real review
    </Tag>
  );
}

export function CheckIcon({ state }: { state: "pass" | "fail" | "warn" }) {
  const common = "size-3.5 shrink-0";
  if (state === "pass") return <Check aria-hidden className={`${common} text-ok`} strokeWidth={2.5} />;
  if (state === "fail") return <X aria-hidden className={`${common} text-mark`} strokeWidth={2.5} />;
  return <AlertTriangle aria-hidden className={`${common} text-warn`} strokeWidth={2.25} />;
}

export function Dot({ tone }: { tone: Tone }) {
  return <Circle aria-hidden className={`size-2 fill-current ${TONE_TEXT[tone]}`} />;
}

export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`tag text-ink-3 ${className}`}>{children}</p>;
}

export function SectionTitle({ children, id, className = "" }: { children: ReactNode; id?: string; className?: string }) {
  return (
    <h2 id={id} className={`font-display text-2xl leading-tight tracking-[-0.01em] ${className}`}>
      {children}
    </h2>
  );
}

/** Markdown with no raw HTML; react-markdown strips unsafe URL schemes. */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose-notes text-[0.9375rem] text-ink">
      <ReactMarkdown
        skipHtml
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer noopener">
              {children}
            </a>
          ),
          img: ({ alt }) => <span className="text-ink-3">[image: {alt}]</span>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="border-y border-dashed border-rule-strong py-12 text-center">
      <p className="font-display text-xl italic">{title}</p>
      {children && <div className="mx-auto mt-2 max-w-md text-sm text-ink-2">{children}</div>}
      {action && <div className="mt-5 flex justify-center gap-3">{action}</div>}
    </div>
  );
}

export const buttonClass = {
  primary:
    "inline-flex items-center justify-center gap-2 rounded-[4px] bg-ink px-3.5 py-2 text-sm font-medium text-paper transition-colors hover:bg-ink-2 disabled:cursor-not-allowed disabled:opacity-50",
  secondary:
    "inline-flex items-center justify-center gap-2 rounded-[4px] border border-rule-strong bg-sheet px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:border-ink disabled:cursor-not-allowed disabled:opacity-50",
  ghost:
    "inline-flex items-center justify-center gap-1.5 rounded-[4px] px-2 py-1.5 text-sm text-ink-2 transition-colors hover:bg-rule/50 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50",
};

export const inputClass =
  "w-full rounded-[4px] border border-rule-strong bg-sheet px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus-visible:border-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20";

export const labelClass = "mb-1 block text-xs font-medium text-ink-2";
