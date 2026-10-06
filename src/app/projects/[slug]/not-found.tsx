import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-20">
      <h1 className="font-display text-4xl">No such project</h1>
      <p className="mt-3 text-ink-2">It may have been renamed or removed from the data directory.</p>
      <Link href="/" className="mt-6 inline-block underline underline-offset-4">Back to the library</Link>
    </div>
  );
}
