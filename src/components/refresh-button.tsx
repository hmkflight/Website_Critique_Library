"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { buttonClass } from "./ui";

/** Re-reads the data directory so files Claude wrote externally appear. */
export function RefreshButton({ label = "Refresh" }: { label?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className={buttonClass.secondary}
      onClick={() => start(() => router.refresh())}
      aria-busy={pending}
      title="Reload records from the data directory"
    >
      <RefreshCw aria-hidden className={`size-4 ${pending ? "motion-safe:animate-spin" : ""}`} />
      {pending ? "Refreshing…" : label}
    </button>
  );
}
