"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { send } from "@/lib/client";
import { Dialog } from "./dialog";
import { buttonClass, inputClass, labelClass } from "./ui";

export function AddProjectDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Register a website">
      <AddProjectForm onClose={onClose} />
    </Dialog>
  );
}

function AddProjectForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const get = (k: string) => String(f.get(k) ?? "").trim();
    setBusy(true);
    setError(null);
    const res = await send<{ project: { id: string } }>("/api/projects", {
      method: "POST",
      json: {
        name: get("name"),
        clientName: get("clientName"),
        websiteUrl: get("websiteUrl"),
        repositoryUrl: get("repositoryUrl"),
        localPath: get("localPath"),
        buildOrigin: get("buildOrigin") || "Codex",
        description: get("description"),
      },
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onClose();
    router.push(`/projects/${res.data.project.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <p className="text-sm text-ink-2 sm:col-span-2">
        Only the essentials are required. Screenshots, reviews and revisions can come later.
      </p>
      <Field label="Project name" name="name" required autoFocus placeholder="Spring launch site" />
      <Field label="Client" name="clientName" required placeholder="Client or studio name" />
      <Field label="Website URL" name="websiteUrl" type="url" required placeholder="https://…" className="sm:col-span-2" hint="http or https only" />
      <Field label="Repository URL" name="repositoryUrl" type="url" placeholder="https://github.com/…" hint="Optional" />
      <Field label="Local repository path" name="localPath" placeholder="~/Sites/client-site" hint="Optional. Stored as text, never executed." />
      <Field label="Build origin" name="buildOrigin" defaultValue="Codex" />
      <div className="sm:col-span-2">
        <label htmlFor="description" className={labelClass}>Description</label>
        <textarea id="description" name="description" rows={3} className={inputClass} placeholder="What the site is for and what the master prompt asked for." />
      </div>
      {error && (
        <p role="alert" className="text-sm text-mark sm:col-span-2">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2 sm:col-span-2">
        <button type="button" className={buttonClass.secondary} onClick={onClose}>Cancel</button>
        <button type="submit" className={buttonClass.primary} disabled={busy}>{busy ? "Saving…" : "Register project"}</button>
      </div>
    </form>
  );
}

function Field({ label, name, hint, className = "", ...rest }: { label: string; name: string; hint?: string; className?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={className}>
      <label htmlFor={name} className={labelClass}>
        {label} {rest.required && <span aria-hidden className="text-mark">*</span>}
      </label>
      <input id={name} name={name} className={inputClass} aria-describedby={hint ? `${name}-hint` : undefined} {...rest} />
      {hint && <p id={`${name}-hint`} className="mt-1 text-xs text-ink-3">{hint}</p>}
    </div>
  );
}
