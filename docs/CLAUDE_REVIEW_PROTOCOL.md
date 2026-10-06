# Claude Review Protocol

How Claude Code critiques and revises a Codex-built website and records the work so the Website Critique Library can show it to Hudson.

**Pipeline:** ChatGPT master prompt → Codex website build → **Claude Code critique/revision** → **Hudson approval**.

**Principle: improve before replacing.** First understand the original Codex vision and keep it. Identify the strong decisions, fix the weak ones, and verify every change. Keep bold composition and meaningful motion when they work. Do not redesign what isn't broken.

---

## 0. Confirm targets before touching anything

1. **Website repository.** Get the absolute path of the site's repo, confirm it is a git repo, and record the current commit (`git rev-parse --short HEAD`).
2. **Library project directory.** Find it at `$CRITIQUE_DATA_DIR/projects/<project-id>/`. The default data directory is `<library repo>/library-data`. Read `project.json` and confirm the `websiteUrl` and `localPath` match the repository you are reviewing.
3. If either target is ambiguous, stop and ask. Never write to a project folder you have not confirmed.

## 1. Understand the concept, then record strengths

- Read the project `description`, the existing reviews/revisions and Hudson's notes (read-only) to learn the intent.
- Run the site locally. Walk every primary page.
- Write down the strengths **first**: the decisions that make the site distinctive, specific to the client, or well crafted. These go in `strengths[]`. Use `KEEP` findings for specific choices that later revisions must preserve.

## 2. Review checklist

For each area, inspect the actual rendered pages:

| Area | Category | Look for |
|---|---|---|
| Visual quality | `VISUAL`, `TYPOGRAPHY`, `COLOR`, `COMPOSITION` | hierarchy, type scale, rhythm, color discipline, repetitive card layouts |
| Client specificity | `CLIENT_SPECIFICITY` | does it feel like *this* client, or a template? |
| Content completeness | `CONTENT` | placeholders, lorem ipsum, missing pages, broken copy |
| Meaningful motion | `MOTION` | motion that supports meaning, not generic fades; `prefers-reduced-motion` |
| UX | `UX` | navigation, calls to action, forms, error states |
| Responsive | `RESPONSIVE` | overflow, broken wraps, touch targets |
| Accessibility | `ACCESSIBILITY` | contrast, keyboard path, focus visibility, labels, alt text, landmarks |
| Functionality | `FUNCTIONAL` | links, forms, cart/checkout, console errors |
| Performance | `PERFORMANCE` | heavy images, layout shift, blocking scripts |

**Required viewports:**

| Label | Size |
|---|---|
| Desktop | 1440×900 |
| Tablet | 834×1194 |
| Mobile | 390×844 |
| Short mobile | 375×667 |

## 3. Record precise findings

Each finding needs:

- A stable `id` (`F-001`, `F-002`, …). **Reuse the same ID** when a later review covers the same problem. Never renumber.
- `category` and `severity`:
  - `BLOCKER`: the site cannot ship (broken purchase, crash, inaccessible primary path).
  - `MAJOR`: a significant quality, accessibility or content gap.
  - `MODERATE` or `MINOR`: worth fixing, not launch-critical.
  - `KEEP`: a successful decision to preserve. It is never counted as a defect.
- `observation`: what you saw, exactly, with `location.page`, `location.section` and `location.viewport`.
- `evidence`: screenshot IDs, URLs or file references.
- `recommendation`: the smallest change that fixes the problem while keeping the concept.

## 4. Screenshots

- Capture **before** screenshots of every view you intend to change, **before** changing it.
- After the change, capture a comparable **after** screenshot: same page, same viewport, same scroll position.
- Save the images to `screenshots/before/` and `screenshots/after/` as PNG, JPEG or WebP, and add entries to `screenshots/screenshots.json`. Give a before and an after of the same view the same `pairId`. Record the viewport you actually used. The Library flags pairs whose viewports or proportions differ.

## 5. Revise

- Improve the existing site. Avoid unnecessary redesigns, repetitive card grids and generic animation.
- Make focused commits in the website repo. Record the commit in the revision.

## 6. Verify, then log the revision

Write `revisions/revision-NNN.json` (the next number) with:

- `changes[]`: the exact changes, each linked to `findingIds`.
- `filesTouched[]`, `addressedFindingIds[]`, `newFindingIds[]`, `commit`, `screenshotIds[]`.
- `browserChecks[]`: what you actually checked in a browser, per viewport, with `PASS`, `FAIL`, `NOT_RUN` or `UNAVAILABLE`.
- `validation[]`: lint, type check, build and tests you actually ran, with their results.
- `findingUpdates[]`: set a finding to `FIXED` **only after a relevant check passed**. Use `IN_PROGRESS` for partial fixes.
- `limitations[]`: anything not done, not verified, or not possible.

**Report honestly.** If a tool was unavailable or a check was not run, say so with `UNAVAILABLE` or `NOT_RUN`. Never record a check you did not perform. A revision with no passing browser check does not count as verification.

Write a revision record even for a verification-only pass with no code changes. Readiness requires verification evidence on the current revision.

## 7. Write files safely

- Write each file to a temporary name in the same folder, then rename it into place. Never leave a half-written JSON file.
- Never overwrite an existing `review-NNN.json` or `revision-NNN.json`. Create the next number.
- Validate before finishing: `npm run validate -- <project-id>` from the Library repo. Fix every reported issue.

## 8. What Claude must never touch

- `notes/hudson.md` and `notes/client-feedback.md`.
- `project.json` fields `approval`, `hudsonAcceptances` and `status`. These are Hudson's.
- Claude's `assessment` is advisory. It never approves anything.

## File layout

```
$CRITIQUE_DATA_DIR/projects/<project-id>/
  project.json                 # Library/Hudson-owned (read-only for Claude)
  reviews/review-001.json      # Claude-authored
  revisions/revision-001.json  # Claude-authored
  screenshots/
    screenshots.json           # manifest (Claude and Library both append)
    before/  after/
  notes/hudson.md  notes/client-feedback.md   # Hudson-owned
```

Schemas: `schemas/*.schema.json` (generated from `src/lib/schema.ts`). Examples: `docs/examples/`. Full worked sample: `demo/projects/demo-halden-ceramics/` (fictional).
