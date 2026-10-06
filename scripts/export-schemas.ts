/** Regenerate schemas/*.schema.json from src/lib/schema.ts. */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { projectSchema, reviewSchema, revisionSchema, screenshotManifestSchema } from "../src/lib/schema";

const out = path.join(process.cwd(), "schemas");
for (const [name, schema] of Object.entries({
  project: projectSchema,
  review: reviewSchema,
  revision: revisionSchema,
  screenshots: screenshotManifestSchema,
})) {
  const json = z.toJSONSchema(schema, { io: "input", unrepresentable: "any" });
  writeFileSync(path.join(out, `${name}.schema.json`), JSON.stringify({ $id: `wcl/${name}.schema.json`, title: `${name} (schemaVersion 1)`, ...json }, null, 2) + "\n");
  console.log(`schemas/${name}.schema.json`);
}
