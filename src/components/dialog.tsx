"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

/** Native <dialog> modal: focus trapping, Escape and inert background for free. */
export function Dialog({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="dialog-title"
      className="m-auto w-[min(640px,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-[6px] bg-sheet p-0 text-ink shadow-2xl"
    >
      <div className="flex items-center justify-between border-b border-rule px-6 py-4">
        <h2 id="dialog-title" className="font-display text-2xl">{title}</h2>
        <button type="button" onClick={onClose} className="rounded p-1 text-ink-2 hover:bg-rule/60" aria-label="Close">
          <X aria-hidden className="size-5" />
        </button>
      </div>
      <div className="px-6 py-5">{open && children}</div>
    </dialog>
  );
}
