"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="py-20">
      <h1 className="font-display text-4xl">Something went wrong reading the library</h1>
      <p className="mt-3 max-w-xl text-ink-2">{error.message || "Unexpected error."} Check the data directory and try again.</p>
      <button type="button" onClick={reset} className="mt-6 rounded bg-ink px-3 py-2 text-sm text-paper">Try again</button>
    </div>
  );
}
