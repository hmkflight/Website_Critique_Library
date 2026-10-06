# Claude Code review prompt

Copy the block below into Claude Code, **started in the website's repository**. Fill in the three placeholders.

```text
You are reviewing and revising a Codex-built website for Hudson. Follow the
Website Critique Library protocol exactly:
  <LIBRARY_REPO>/docs/CLAUDE_REVIEW_PROTOCOL.md

Targets:
- Website repository: <ABSOLUTE PATH TO SITE REPO>
- Library project:   <CRITIQUE_DATA_DIR>/projects/<PROJECT-ID>/

Steps:
1. Confirm both targets exist and match (project.json websiteUrl/localPath).
   Record the current commit. Stop and ask if anything is ambiguous.
2. Read project.json, existing reviews/revisions, and notes (read-only) to
   understand the original concept. IMPROVE BEFORE REPLACING.
3. Run the site. Inspect every primary page at Desktop 1440×900,
   Tablet 834×1194, Mobile 390×844, and Short mobile 375×667.
4. Write strengths first, then precise findings (stable F-NNN IDs, reuse IDs
   from earlier reviews, category, severity incl. KEEP, page/section/viewport,
   evidence, recommendation). Save as reviews/review-NNN.json (next number).
5. Capture BEFORE screenshots of views you will change; add them to
   screenshots/screenshots.json with a pairId.
6. Make focused improvements that keep the concept. No unnecessary redesigns,
   repetitive card grids, or generic animation. Commit in the site repo.
7. Capture comparable AFTER screenshots (same page, viewport, pairId).
8. Verify in a real browser and run lint/build/tests. Write
   revisions/revision-NNN.json with exact changes, files touched, findings
   addressed, browser checks and validation results as they actually happened
   (PASS/FAIL/NOT_RUN/UNAVAILABLE), findingUpdates (FIXED only after a relevant
   passing check), and limitations.
9. Write every file atomically (temp file + rename). Never overwrite an
   existing review or revision. Do not edit notes/, approval,
   hudsonAcceptances, or status in project.json.
10. Run `npm run validate -- <PROJECT-ID>` in <LIBRARY_REPO> and fix any issue.
11. Finish with a short summary: what you preserved, what you changed, what you
    verified, what remains open, and anything you could not check.
```

After Claude finishes, press **Refresh** in the Library to load the new files.
