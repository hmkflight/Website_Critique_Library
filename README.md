# Website Critique Library

Hudson's local workspace for the Claude/Hudson half of the website pipeline:

**ChatGPT master prompt → Codex website build → Claude Code critique/revision → Hudson approval.**

Claude Code runs separately and writes structured review, revision and screenshot files into a shared data directory. The Library reads those files and shows them clearly. Hudson writes notes, makes decisions and gives explicit approval. The Library never launches Claude, calls AI APIs, or executes anything from a repository.

## Requirements

- Node.js 20.9 or newer (developed on 22)
- macOS, Linux or Windows with a persistent local filesystem

## Install and run

```bash
npm install
npm run build
npm start            # http://127.0.0.1:3000 (binds to localhost only)
# or, while developing:
npm run dev
```

To explore with sample content, run `npm run demo:install` or click **Load demo project** in the empty library. The demo is a fictional studio. Every screen labels it "Demo · not a real review". Remove it with `npm run demo:remove` or the footer button. Removal deletes only folders whose `project.json` has `"demo": true`.

## Data location

All state lives in plain files under `CRITIQUE_DATA_DIR`. The default is `./library-data` in this repo, which is git-ignored.

```bash
CRITIQUE_DATA_DIR=~/Documents/critique-data npm start
```

```
projects/<project-id>/
  project.json                   # registration, status, Hudson approval + acceptances
  reviews/review-001.json        # Claude-authored
  revisions/revision-001.json    # Claude-authored
  screenshots/screenshots.json   # screenshot metadata (explicit before/after pairing)
  screenshots/before/  screenshots/after/
  notes/hudson.md  notes/client-feedback.md
```

- Every write goes to a temporary file and is then renamed into place, so a write is atomic.
- Writes carry the version of the file the user loaded. If the file changed on disk since then, the write is refused (HTTP 409) instead of silently overwriting.
- Invalid files are reported in the UI and skipped. They are never rewritten.

**Backup:** copy or sync the whole data directory (for example with Time Machine, `rsync -a`, or a private git repo). There is no database.

**Hosting:** V1 is a local single-user app. It has no authentication and needs a durable, writable filesystem. Do not expose it on a network or deploy it to serverless or ephemeral hosting. Remote use would require adding authentication and durable storage first.

## Using it with Claude Code

1. Register the website in the Library (**Add project**). Only name, client and URL are required.
2. In Claude Code, opened in the **website's** repository, paste the prompt from [`docs/CLAUDE_REVIEW_PROMPT.md`](docs/CLAUDE_REVIEW_PROMPT.md) with the paths filled in.
3. Claude follows [`docs/CLAUDE_REVIEW_PROTOCOL.md`](docs/CLAUDE_REVIEW_PROTOCOL.md): strengths first, precise findings, before/after screenshots, verified revisions, honest limitations.
4. Press **Refresh** in the Library to load the new files. There are no live updates in V1.
5. Review in **Final review**: accept major findings with a rationale if needed, write notes, and approve the current revision.

### Readiness rules

Readiness is computed from the records. The project status is a workflow label only.

- **Client ready** requires all of:
  - the latest review is `COMPLETE`
  - the current revision has at least one passing browser check and no failed checks
  - no unfixed `BLOCKER`
  - every `MAJOR` is fixed or accepted by Hudson with a rationale
  - Hudson has approved this exact revision and review
- Any later revision or review invalidates an earlier approval.
- `KEEP` findings are strengths to preserve. They never count as defects.
- Deferred and accepted findings stay visible.
- Counts use stable finding IDs, and the latest record wins, so repeated findings are not double-counted.

## Commands

| Command | Purpose |
|---|---|
| `npm run validate` | Validate every project in the data directory. Pass a project ID to check one, or `--dir <path>` to check another root. Exits 1 on problems. |
| `npm test` | Unit tests for storage, validation and readiness |
| `npm run lint` / `npm run typecheck` | Static checks |
| `npm run schemas` | Regenerate `schemas/*.schema.json` from `src/lib/schema.ts` |
| `npm run demo:install` / `demo:remove` | Add or remove the fictional demo project |

## Reference

- Schemas: [`schemas/`](schemas). The source of truth is `src/lib/schema.ts` (Zod, `schemaVersion: 1`).
- Example records: [`docs/examples/`](docs/examples)
- Full worked sample: [`demo/projects/demo-halden-ceramics/`](demo/projects/demo-halden-ceramics)

## Security notes

- Markdown notes render without raw HTML. Links open in a new tab with `noopener`.
- Website and repository URLs must be `http` or `https`. A local repository path is stored as text and never executed.
- All paths resolve inside the data root, and project IDs and file names are pattern-checked.
- Screenshots are served only by manifest ID, with `nosniff` and a sandboxing CSP.
- Uploads must be real PNG, JPEG or WebP (checked by magic bytes and decoded dimensions), 15 MB or less.
