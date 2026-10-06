import type { Project, Screenshot } from "./schema";

/** Explicit thumbnail first, else the newest desktop "after" capture. */
export function pickThumbnail(bundle: { project: Pick<Project, "thumbnailScreenshotId">; screenshots: Screenshot[] }): Screenshot | null {
  const s = bundle.screenshots;
  if (bundle.project.thumbnailScreenshotId) {
    const chosen = s.find((x) => x.id === bundle.project.thumbnailScreenshotId);
    if (chosen) return chosen;
  }
  const desktop = (x: Screenshot) => x.viewport.width >= 1024;
  const newest = [...s].reverse();
  return (
    newest.find((x) => x.role === "AFTER" && desktop(x)) ??
    newest.find((x) => x.role === "AFTER") ??
    newest.find(desktop) ??
    newest[0] ??
    null
  );
}
