import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { projectSchema, reviewSchema, revisionSchema, screenshotManifestSchema } from "../src/lib/schema";

const read = (f: string) => JSON.parse(readFileSync(path.join(process.cwd(), "docs/examples", f), "utf8"));

describe("documented examples", () => {
  it("all validate against the schemas", () => {
    expect(projectSchema.safeParse(read("project.json")).success).toBe(true);
    expect(reviewSchema.safeParse(read("review-001.json")).success).toBe(true);
    expect(revisionSchema.safeParse(read("revision-001.json")).success).toBe(true);
    expect(screenshotManifestSchema.safeParse(read("screenshots.json")).success).toBe(true);
  });
});
