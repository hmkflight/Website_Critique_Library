"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ProjectBundle } from "@/lib/storage";
import { send } from "@/lib/client";
import { revisionLabel } from "@/lib/labels";
import { Dialog } from "../dialog";
import { buttonClass, inputClass, labelClass } from "../ui";

const VIEWPORTS = [
  { label: "Desktop", width: 1440, height: 900 },
  { label: "Laptop", width: 1280, height: 800 },
  { label: "Tablet", width: 834, height: 1194 },
  { label: "Mobile", width: 390, height: 844 },
  { label: "Short mobile", width: 375, height: 667 },
];
const MAX_BYTES = 15 * 1024 * 1024;
const TYPES = ["image/png", "image/jpeg", "image/webp"];

export function UploadScreenshotDialog({
  open,
  onClose,
  bundle,
  pairs,
}: {
  open: boolean;
  onClose: () => void;
  bundle: ProjectBundle;
  pairs: { pairId: string; page: string; viewport: string }[];
}) {
  return (
    <Dialog open={open} onClose={onClose} title="Import screenshot">
      <UploadForm bundle={bundle} pairs={pairs} onClose={onClose} />
    </Dialog>
  );
}

function UploadForm({ bundle, pairs, onClose }: { bundle: ProjectBundle; pairs: { pairId: string; page: string; viewport: string }[]; onClose: () => void }) {
  const router = useRouter();
  const [preset, setPreset] = useState("Desktop");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const vp = VIEWPORTS.find((v) => v.label === preset);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) return setError("Choose an image file.");
    if (!TYPES.includes(file.type)) return setError("Only PNG, JPEG or WebP images are accepted.");
    if (file.size > MAX_BYTES) return setError("Image is larger than 15 MB.");
    if (preset !== "Custom" && vp) {
      form.set("viewportLabel", vp.label);
      form.set("viewportWidth", String(vp.width));
      form.set("viewportHeight", String(vp.height));
    }
    form.set("baseVersion", bundle.manifestVersion);
    setBusy(true);
    setError(null);
    const res = await send(`/api/projects/${bundle.slug}/screenshots`, { method: "POST", body: form });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    onClose();
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label htmlFor="file" className={labelClass}>Image <span aria-hidden className="text-mark">*</span></label>
        <input id="file" name="file" type="file" required accept="image/png,image/jpeg,image/webp" className={`${inputClass} file:mr-3 file:rounded file:border-0 file:bg-ink file:px-2 file:py-1 file:text-paper`} aria-describedby="file-hint" />
        <p id="file-hint" className="mt-1 text-xs text-ink-3">PNG, JPEG or WebP, up to 15 MB. Stored unaltered.</p>
      </div>
      <fieldset className="sm:col-span-2">
        <legend className={labelClass}>Role</legend>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="radio" name="role" value="BEFORE" defaultChecked /> Before</label>
          <label className="flex items-center gap-2"><input type="radio" name="role" value="AFTER" /> After</label>
        </div>
      </fieldset>
      <div>
        <label htmlFor="page" className={labelClass}>Page <span aria-hidden className="text-mark">*</span></label>
        <input id="page" name="page" required list="page-options" placeholder="Home, /menu, Contact…" className={inputClass} />
        <datalist id="page-options">{[...new Set(pairs.map((p) => p.page))].map((p) => <option key={p} value={p} />)}</datalist>
      </div>
      <div>
        <label htmlFor="preset" className={labelClass}>Viewport</label>
        <select id="preset" value={preset} onChange={(e) => setPreset(e.target.value)} className={inputClass}>
          {VIEWPORTS.map((v) => <option key={v.label} value={v.label}>{v.label} ({v.width}×{v.height})</option>)}
          <option value="Custom">Custom…</option>
        </select>
      </div>
      {preset === "Custom" && (
        <div className="grid grid-cols-3 gap-3 sm:col-span-2">
          <div><label htmlFor="viewportLabel" className={labelClass}>Label</label><input id="viewportLabel" name="viewportLabel" required className={inputClass} /></div>
          <div><label htmlFor="viewportWidth" className={labelClass}>Width</label><input id="viewportWidth" name="viewportWidth" type="number" min={1} max={10000} required className={inputClass} /></div>
          <div><label htmlFor="viewportHeight" className={labelClass}>Height</label><input id="viewportHeight" name="viewportHeight" type="number" min={1} max={20000} required className={inputClass} /></div>
        </div>
      )}
      <div>
        <label htmlFor="pairId" className={labelClass}>Pair with</label>
        <select id="pairId" name="pairId" className={inputClass} aria-describedby="pair-hint">
          <option value="">New view (from page + viewport)</option>
          {pairs.map((p) => <option key={p.pairId} value={p.pairId}>{p.page} · {p.viewport}</option>)}
        </select>
        <p id="pair-hint" className="mt-1 text-xs text-ink-3">Before and after captures of the same view share a pair.</p>
      </div>
      <div>
        <label htmlFor="revisionId" className={labelClass}>Revision</label>
        <select id="revisionId" name="revisionId" className={inputClass}>
          <option value="">Original build / none</option>
          {bundle.revisions.map((r) => <option key={r.id} value={r.id}>{revisionLabel(r.id)}: {r.summary.slice(0, 40)}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="reviewId" className={labelClass}>Review</label>
        <select id="reviewId" name="reviewId" className={inputClass}>
          <option value="">None</option>
          {bundle.reviews.map((r) => <option key={r.id} value={r.id}>{r.id}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="caption" className={labelClass}>Caption</label>
        <input id="caption" name="caption" maxLength={500} className={inputClass} />
      </div>
      {error && <p role="alert" className="text-sm text-mark sm:col-span-2">{error}</p>}
      <div className="flex justify-end gap-2 sm:col-span-2">
        <button type="button" className={buttonClass.secondary} onClick={onClose}>Cancel</button>
        <button type="submit" className={buttonClass.primary} disabled={busy}>{busy ? "Importing…" : "Import"}</button>
      </div>
    </form>
  );
}
