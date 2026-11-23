# Forge UI: design and interaction standard

**Version 1.0 · from Forge Grants (Nov 2026).** Use this to give any Forge Institute application the same look, feel and behavior. Hand this file to Claude at the start of a new project ("follow DESIGN.md"), or install the `forge-ui` skill (see the end).

The kit:

| File | Use |
|---|---|
| `DESIGN.md` | This standard: brand, layout, components and behavior rules. |
| `forge-ui.css` | Design tokens (light and dark) and every component's styles. |
| `forge-ui.js` | Star rating, tag input, people picker, confirm dialog, two-step remove, toast, theme, sidebar, formatting helpers. No dependencies. |
| `styleguide.html` | Live page showing every element. Open it in a browser next to the CSS and JS. |
| `forge-logo.png` | Forge logo for dark backgrounds (transparent PNG, 292×96). |
| `SKILL.md` | Claude Code skill that applies this standard. |

---

## 1. Brand

**Colors** (Forge brand guide, 9.2024). Always use the CSS variables, never raw hex, so dark mode works.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--navy` | `#041C2C` | `#041C2C` | Sidebar, high-emphasis tiles |
| `--navy-ink` | `#0072CE` | `#4DA3EC` | Primary buttons, chart bars, brand blue |
| `--accent` | `#E57200` | `#F08A2A` | Focus ring, current-page marker, count badges. Never body text. |
| `--link` | `#0066B8` | `#6DB4F0` | Links, ghost buttons |
| `--bg` / `--surface` / `--surface-2` | `#eef2f6` / `#fff` / `#f5f8fb` | `#06141f` / `#0c2232` / `#102a3d` | Page, cards, table headers and hovers |
| `--line` | `#d9e1e9` | `#1f3b51` | Borders and dividers |
| `--fg` / `--muted` | `#0b1d2a` / `#566878` | `#e6edf3` / `#97aabb` | Text / secondary text |
| `--good`, `--info`, `--warn`, `--bad`, `--idle` (each with `-bg`) | | | Status only: success, in progress/info, caution, error, neutral |

Special purpose: `--star` (#e0a100) for ratings; `--ver-*` green for verified, source-of-truth sections; `--fb-*` light yellow with dark orange text for suggestions and comments; `--rt-*` light red with dark red text for red-team or critical review.

**Fonts:** Archivo (headings, 600–700), Inter (text, 400–600), IBM Plex Mono (numbers, dates, IDs, scores, money). Load all three from Google Fonts (link at the top of `forge-ui.css`).

**Logo:** `forge-logo.png` on the navy sidebar, 30px tall, followed by a thin divider and the app name in uppercase Archivo ("GRANTS"). In a collapsed sidebar, show only the "F" emblem. Don't recolor or stretch it.

**Voice:** plain, specific, sentence case. Buttons say what they do ("Save changes", "Draft concepts with Claude", "Replace this section"). Messages say what happened and what to do next ("Couldn't save. Check your connection and try again."). No marketing language, no jargon, no exclamation marks.

## 2. Layout

- **App shell:** navy **sidebar on the left** (232px; collapsible to 68px icons-only, remembered per browser) and a content column (max 1200px, 16px side gutters).
- **Sidebar:** brand at top; one line icon (19px, 1.8 stroke) plus label per page; the current page gets a lighter fill and a 3px orange inner edge. **Settings** sits at the bottom left with the collapse button.
- **Top bar:** thin, no fill. Top right shows **"Last updated <date, time> CT"** and, under it, **"Pushed to GitHub <date, time> CT · <commit>"** (see the `last-updated-header` kit).
- **Phones (under 900px):** the sidebar becomes a slide-out menu opened by a ☰ button; it closes on a pick, a tap outside or Esc. Everything must fit a 390px-wide screen with no sideways scrolling.
- **Page pattern:** `.head` (H1 + one-line `.sub` explaining the page, primary action on the right) → filters row → content panels. Section titles use `.sec-title`; cards use `.panel`.
- **Headline numbers:** a row of `.stat` tiles (uppercase label, large mono number, one-line explanation). Tiles that link somewhere are `<a class="stat">`. One `.stat.hot` (navy) at most per row, for the number that matters most.
- **Dashboards:** headline tiles → status funnel → work queues (deadlines, assignments) → results. Keep verified figures and system-calculated figures in **separate sections** (see 4.9).

## 3. Components

| Need | Use |
|---|---|
| Primary / secondary / destructive action | `.btn` / `.btn-ghost` / `.btn-danger` (`.btn-sm` for small) |
| Form | `.form` grid: label text above each field; `.wide` for full-width; `.actions` row at the end |
| Filters | `.filters` row: search, selects, checkboxes, then **Reset** |
| Multi-value text (tags, keywords, capabilities) | Tag input: `FUI.tagInput` (rules in 4.2) |
| Choose people | People picker: `FUI.peoplePicker` (rules in 4.3) |
| Rating | `FUI.stars` (rules in 4.1) |
| One-of-a-few view switch | `.seg` segmented control (Board / List; Opportunities / Submissions / Both) |
| Show/hide many options | `<details class="menu">` with checkboxes and preset buttons |
| Small labels | `.tag` (source, uppercase mono), `.cat` (category), `.chips` (capabilities `.cap`, skills `.skill`), `.pill` (stage/status), `.person` (a person), `.badge-count` (counts) |
| Score out of 10 | `.score` `.s8` (8+) `.s6` (6–7) `.s4` (4–5) `.s1` (below 4); add `.pre` and a `*` for unreviewed estimates |
| Deadlines | `.dl` `.urgent` (<30 days, red) `.soon` (<90, orange) `.ok` (90+, green) `.none` |
| Yes / no / unknown checks | `.dots` with `.dot.pass` / `.fail` / `.unknown`, always with a text explanation on hover or nearby |
| Lists and data | `.tablewrap` + `table` (uppercase mono headers, sortable headers show ▲/▼), `.list` for short lists |
| Status messages | `.notice` (`.info`, `.good`, `.bad`); `.job` line under an action for progress and errors |
| Charts | Single-series bars (`.kbars`, or vertical year bars) in brand blue. No dual axes, no pie charts for more than 3 parts. |

## 4. Behavior rules

### 4.1 Star ratings (1–5)
- Five stars; **click to rate, click your current rating again to clear it**. Hover previews; keyboard: arrows move, 1–5 set, Delete or 0 clears.
- Each person rates for themselves. Show **your rating** in the stars and the **team average and count** beside it ("Team 3.5 · 2"); hover lists who rated what.
- Save immediately on click (no Save button), record it in history, and update every viewer live.
- Read-only users see the stars without hover or click.
- Filters offer "Any rating", "1+ … 4+ stars", "5 stars", a choice of **my rating vs team average**, and an **"Include unrated"** checkbox (on by default, so unrated items aren't silently hidden).
- A team average of 3+ can trigger follow-up work (in Forge Grants: proposal coaching).

### 4.2 Tag inputs (tags in a text box)
- Chips sit inside the box; type and press **Enter, comma, semicolon or Tab** to add. Pasting "a, b; c" adds each. **Backspace** in an empty box removes the last chip; **×** removes one.
- Trim spaces, collapse inner spaces, ignore duplicates (case-insensitive), cap length (80 characters) and count (60).
- Offer suggestions as you type (arrow keys + Enter to pick) from existing values, so the same idea isn't spelled three ways.
- Use for keywords, focus areas, capabilities, skills, partners on an award. Use the people picker instead for people.

### 4.3 People and ownership
- Pick people from the team directory by name, store their **account id**, never their name, and resolve names when displaying.
- Always offer **"Assign to me"**. Multiple owners are allowed.
- Show owners on cards and rows; offer an owner filter including "Assigned to me" and "Unassigned".
- Link staff records to accounts so a person's work rolls up to their profile.

### 4.4 Saving, editing and confirmation
- Edits stay local until **Save**; warn before leaving with unsaved changes; leaving a page with a draft saves it.
- **Two-step remove** for inline deletes: "Remove" → "Confirm remove" / "Cancel".
- **Popup confirmation** (`FUI.confirm`, red title) before anything that overwrites work: replacing text with AI output, regenerating options someone already built on, deleting a document others rely on. Say exactly what will be lost ("replaces the text in 7 sections, 412 words").
- Show progress and results inline in a `.job` line ("Saving…", "Saved.", "Couldn't save…").
- After closing an edit form or going back, return the user to **where they were on the page**.

### 4.5 Shared data and history
- Everything saved is shared with the whole team and visible to everyone who can open the app; say so near uploads.
- **Every change is recorded** in a History page: who, when, what, before → after. History is how users undo mistakes.
- Personal view preferences (filters, sort, Board/List, theme, sidebar width) are kept **per browser** and survive reloads; **Reset** clears filters back to sensible defaults.
- When filters hide things, **say so** ("10 cards are hidden by your filters · Reset filters").

### 4.6 Lists, filters and boards
- Default to useful, not exhaustive (for example Fit 4+ and 2+ stars, with unrated included). Never silently cap a list: show "Showing 300 of 459" with **Show more / Show all**.
- Sort by clicking column headers (click again to reverse) or a Sort menu with ↑/↓.
- Workflows with stages offer **Board (kanban) and List** views of the same data, a **Stages** menu to show or hide stages (with presets), and drag-and-drop plus a stage menu on each card or row.

### 4.7 Uploads and documents
- Accept PDF, Word (.docx), PowerPoint (.pptx), Excel (.xlsx) and CSV; read the text in the browser; explain unsupported formats (old .doc/.xls) in plain words.
- When AI extracts data from a document, show a **review step** (checkboxes, flags for possible duplicates, notes on anything it couldn't confirm) before saving.

### 4.8 Working with Claude (AI)
- Label AI output as Claude's; treat it as a **first draft**. Instruct Claude to use only the sources given, never invent facts, numbers or past performance, and mark missing facts as **[confirm: …]** (highlighted on export).
- **Compare before replace:** show Claude's version beside the user's ("Use this version" / "Keep mine").
- Feedback goes in a light-yellow box (`.fbbox`); critical review (red team) in a light-red box (`.rtbox`), kept separate from the content itself.
- Cite sources for research and lookups; show where each figure came from.
- Background work (web research, lookups) is queued and its status shown ("queued", "working", "done"), with the expected time.

### 4.9 Verified figures
- Numbers that must be exact (awards won, dollar totals) come **only from an uploaded source document**, are shown in a **green shaded `.verified` section** with a "✓ Verified" badge and the source named, and are re-checked every time the page loads.
- Hand-entered or hand-edited figures are marked **⚠ Not verified** and excluded, with a note saying how many and why.
- System-calculated figures (win rate, pipeline counts) live in a separate, unshaded section labeled as calculated.

### 4.10 Dates, numbers and time
- Show times in **Central time** with "CT" (or the team's zone, labeled). Dates like "Nov 23, 2026"; deadlines add days left ("· 8d left", "· closed").
- Money: `$176K`, `$1.5M`, `$8.13B` (`FUI.money`); numbers in mono with tabular figures.
- Get timestamps from the system clock, never by guessing.

### 4.11 Settings, theme and extras
- Settings page (gear, bottom left): color theme (system / light / dark), sidebar width, feature toggles, and background-job status.
- Optional: a holiday theme on U.S. federal holidays, toggled by clicking the logo.

## 5. Accessibility and quality bar
- Text contrast at least 4.5:1 in both themes; status is never color-alone (always text or an icon too).
- Every control is reachable by keyboard with a visible orange focus ring; icon-only buttons have `aria-label`s; ratings are a radio group.
- Works at 390px wide in light and dark mode with no horizontal scroll; respect "reduce motion".
- Escape all user and AI text before inserting it into the page.
- Test each feature in a real browser (desktop and phone, light and dark) before shipping, and show nothing broken in the console.

## 6. Using this in a new project

1. Copy `forge-ui.css`, `forge-ui.js` and `forge-logo.png` into the project and link them (fonts link is in the CSS header comment).
2. Build pages with the app shell from `styleguide.html` (sidebar, top bar, `main.wrap`).
3. Use the components and follow the behavior rules above; open `styleguide.html` to see each one working.
4. For the last-updated / pushed-to-GitHub header, add the `last-updated-header` kit.

**With Claude Code:** copy this folder to `~/.claude/skills/forge-ui/` (all your projects on that computer) or a repo's `.claude/skills/forge-ui/`, then ask Claude to "build this with the Forge UI standard".
