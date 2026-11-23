# Last updated / Pushed to GitHub header kit

The header from Forge Grants (top right):

> Last updated **Nov 22, 2026, 4:59 PM CT**
> Pushed to GitHub **Nov 22, 2026, 4:58 PM CT** · `e12c717`

A web page can't look up when it was published or ask GitHub for its last push, so both times are **stamped into the page at publish time** and the page just displays them.

| File | What it is |
|---|---|
| `snippet.html` | The `<meta>` tags, header markup, CSS and script. Self-contained; no libraries. |
| `stamp.py` | Fills in the `<meta>` tags: publish time, last pushed commit time and SHA, repo URL. Python 3, standard library only. |
| `SKILL.md` | A Claude Code skill, so Claude can add the header to another project for you. |

## Use it in another Claude project

**Easiest: install the skill once, then ask Claude.** In Claude Code on your own computer:

```bash
mkdir -p ~/.claude/skills/last-updated-header
```

```bash
cp kit/last-updated-header/* ~/.claude/skills/last-updated-header/
```

The skill is then available in every project on that computer. Ask: *"Add the last-updated header with the GitHub push line to this page."* (To share it with a team through a repository instead, copy the folder to that repo's `.claude/skills/last-updated-header/` and commit it.)

**By hand:**
1. Paste the pieces of `snippet.html` into your page (meta tags in `<head>`, the `div` in your header, the style and script once).
2. Copy `stamp.py` into the project.
3. Publish in this order:
   ```bash
   git push -u origin <branch>
   ```
   ```bash
   python3 stamp.py page.html --out publish/page.html
   ```
   then publish `publish/page.html` (for a claude.ai artifact, publish that file).

Stamp **after** pushing so the GitHub line names the commit that's really on GitHub, and stamp into a separate publish copy (`--out`) so stamping never creates another commit.

## Options

- `data-tz="America/New_York" data-tz-label="ET"` on the `div` to change the time zone.
- `--prefix forge` on `stamp.py` and `data-prefix="forge"` on the `div` to use a different meta prefix (Forge Grants uses `forge`).
- `window.luSetDataUpdated(iso)` from your page when its data loads, so "Last updated" shows the later of page and data (Forge Grants uses the data snapshot and the last scan).
- `--remote` / `--branch` on `stamp.py` to read a different remote or branch.
