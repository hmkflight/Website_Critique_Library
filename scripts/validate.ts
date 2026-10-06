/**
 * Validate every project in the data directory (or one project).
 *   npm run validate                  # all projects in CRITIQUE_DATA_DIR
 *   npm run validate -- my-project    # one project
 *   npm run validate -- --dir ./demo  # another data root
 * Exits 1 when any file is invalid. Read-only.
 */
import { dataRoot } from "../src/lib/fsutil";
import { isBroken, listProjectSlugs, loadProject } from "../src/lib/storage";

async function main() {
  const args = process.argv.slice(2);
  const dirIdx = args.indexOf("--dir");
  if (dirIdx >= 0) {
    process.env.CRITIQUE_DATA_DIR = args[dirIdx + 1];
    args.splice(dirIdx, 2);
  }
  const slugs = args.length ? args : await listProjectSlugs();
  console.log(`Data directory: ${dataRoot()}`);
  if (slugs.length === 0) {
    console.log("No projects found.");
    return;
  }
  let failures = 0;
  for (const slug of slugs) {
    try {
      const b = await loadProject(slug);
      if (isBroken(b)) {
        failures++;
        console.log(`✗ ${slug}: cannot load`);
      } else {
        const r = b.readiness;
        const mark = b.issues.length ? "!" : "✓";
        if (b.issues.length) failures++;
        console.log(`${mark} ${slug}: ${b.reviews.length} review(s), ${b.revisions.length} revision(s), ${b.screenshots.length} screenshot(s), ${b.findings.length} finding(s). ${r.label}`);
      }
      for (const i of b.issues) console.log(`    ${i.file}: ${i.message}`);
    } catch (e) {
      failures++;
      console.log(`✗ ${slug}: ${(e as Error).message}`);
    }
  }
  if (failures) {
    console.log(`\n${failures} project(s) with problems.`);
    process.exit(1);
  }
  console.log("\nAll records valid.");
}

main();
