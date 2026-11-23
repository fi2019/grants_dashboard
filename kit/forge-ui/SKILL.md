---
name: forge-ui
description: Apply the Forge Institute UI standard (from Forge Grants) to a web app or claude.ai artifact - brand colors and fonts, left sidebar layout, components, and behavior rules for star ratings, tag inputs, people pickers, confirmations, history, AI drafts and verified figures. Use when building or restyling any Forge Institute application, or when the user asks for the "Forge look and feel".
---

# Forge UI standard

Read `DESIGN.md` in this skill's folder first; it is the standard. Then:

1. Copy `forge-ui.css`, `forge-ui.js` and `forge-logo.png` from this folder into the project (for a single-file artifact, inline the CSS and JS instead and keep the logo as a data URI or uploaded asset). Add the Google Fonts link from the top of `forge-ui.css`.
2. Lay pages out with the app shell shown in `styleguide.html`: navy left sidebar with icons and labels, Settings at the bottom left, thin top bar with "Last updated" (and the `last-updated-header` kit if the project is on GitHub), content in `main.wrap`.
3. Use the components and `FUI.*` helpers instead of inventing new ones: `FUI.stars` for 1-5 ratings, `FUI.tagInput` for any multi-value text field, `FUI.peoplePicker` for owners, `FUI.confirm` before anything that overwrites work, `FUI.armRemove` for inline deletes, `FUI.money` / `FUI.deadlineHtml` / `FUI.scoreHtml` for formatting.
4. Follow the behavior rules in DESIGN.md section 4 (ratings, tags, saving and confirmation, shared history, filters that say what they hide, uploads with a review step, AI drafts with [confirm: ...] and compare-before-replace, verified figures in a green section).
5. Before calling it done, check DESIGN.md section 5 in a browser: desktop and 390px phone, light and dark, keyboard focus visible, nothing in the console.

Use the CSS variables for every color so dark mode works. Keep wording plain and sentence case.
