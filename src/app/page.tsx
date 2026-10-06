import { connection } from "next/server";
import { LibraryView } from "@/components/library-view";
import { dataRoot } from "@/lib/fsutil";
import { listDemoSources } from "@/lib/demo";
import { loadAllProjects } from "@/lib/storage";
import { summarize } from "@/lib/summary";

export default async function LibraryPage() {
  await connection();
  const entries = (await loadAllProjects()).map(summarize);
  const demoAvailable = (await listDemoSources()).length > 0;
  return <LibraryView entries={entries} dataDir={dataRoot()} demoAvailable={demoAvailable} />;
}
