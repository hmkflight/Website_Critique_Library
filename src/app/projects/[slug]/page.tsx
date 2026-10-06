import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowLeft } from "lucide-react";
import { ProjectView } from "@/components/project/project-view";
import { RefreshButton } from "@/components/refresh-button";
import { NotFoundError, InputError } from "@/lib/fsutil";
import { isBroken, loadProject } from "@/lib/storage";

async function load(slug: string) {
  try {
    return await loadProject(slug);
  } catch (e) {
    if (e instanceof NotFoundError || e instanceof InputError) notFound();
    throw e;
  }
}

export async function generateMetadata({ params }: PageProps<"/projects/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  await connection();
  const b = await loadProject(slug).catch(() => null);
  return { title: b && !isBroken(b) ? b.project.name : slug };
}

export default async function ProjectPage({ params }: PageProps<"/projects/[slug]">) {
  await connection();
  const { slug } = await params;
  const bundle = await load(slug);

  if (isBroken(bundle)) {
    return (
      <div className="py-12">
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-ink-2 hover:text-ink">
          <ArrowLeft aria-hidden className="size-4" /> Library
        </Link>
        <h1 className="mt-6 font-display text-4xl">This project could not be loaded</h1>
        <p className="mt-3 max-w-xl text-ink-2">
          The files in <code className="font-mono text-sm">projects/{slug}/</code> did not pass validation. Nothing was changed. Fix the file below, or run <code className="font-mono text-sm">npm run validate</code>, then refresh.
        </p>
        <ul className="mt-6 space-y-2 border-l-2 border-mark pl-4 text-sm">
          {bundle.issues.map((i) => (
            <li key={i.file + i.message}>
              <code className="font-mono">{i.file}</code>: {i.message}
            </li>
          ))}
        </ul>
        <div className="mt-6"><RefreshButton /></div>
      </div>
    );
  }

  return <ProjectView bundle={bundle} />;
}
