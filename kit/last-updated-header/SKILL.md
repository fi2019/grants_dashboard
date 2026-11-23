---
name: last-updated-header
description: Add a top-right header to a web page or claude.ai artifact showing "Last updated <date/time>" and, under it, "Pushed to GitHub <date/time> · <commit>", stamped at publish time. Use when the user asks for a last-updated or last-deployed stamp, a "pushed to GitHub" line, or to reuse the Forge Grants header in another project.
---

# Last updated / Pushed to GitHub header

The page can't call GitHub or know when it was published by itself, so the times are **stamped into `<meta>` tags at publish time** by `stamp.py` (in this skill's folder), and a small script in the page reads them.

## Add it to a project

1. **Copy the snippet.** From `snippet.html` in this skill's folder:
   - put the four `<meta name="app:…">` tags in the page's `<head>`;
   - put the `<div class="lu-header">…</div>` where the header should show (top right of the page header);
   - paste the `<style>` and `<script>` blocks once.
   Match the page's own look: if it has color tokens, set `--lu-muted` and `--lu-ink` to them (and their dark-mode values). Set `data-tz` / `data-tz-label` if the team isn't on Central time.
2. **Copy `stamp.py`** into the project (for example `tools/stamp.py`).
3. **If the page loads its own data** (a JSON snapshot, a database), call `window.luSetDataUpdated(isoTime)` once the data arrives, so "Last updated" shows the later of the page and its data.

## Publish in this order, every time

```bash
git add -A && git commit -m "…"
git push -u origin <branch>
python3 tools/stamp.py page.html --out <publish copy>
```

Then publish the `--out` copy (for a claude.ai artifact, publish that file with the Artifact tool).

- Stamp **after** the push, so `app:pushed` and `app:commit` describe the commit actually on GitHub. The script reads `origin/<current branch>`; pass `--branch` or `--remote` to change that.
- Write the stamp to the **publish copy** (`--out`) rather than the repo file, so stamping never creates a new commit and the repo stays clean.
- `app:published` is the publish time (UTC). `app:repo` comes from the `origin` URL and powers the link on the commit SHA.

## Check it

Open the published page: the header should read "Last updated Nov 22, 2026, 4:59 PM CT" and, below it, "Pushed to GitHub Nov 22, 2026, 4:58 PM CT · abc1234" linking to the commit. If the second line is missing, the branch wasn't pushed before stamping, or the `<meta>` tags have a different prefix than `data-prefix`.
