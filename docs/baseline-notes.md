# Baseline notes

Reviewed on 2026-11-19, using two inputs:

1. **The previous project** (`grant-dashboard`, Next.js 16 + Supabase + xAI Grok, about 12.5k lines). It was shared as a Drive export and is not in this repo.
2. **The sample report** `grant_report_20261015_181749.pdf` from the "Grant Checker" trial (Claude-powered, 115 evaluated, 4 recommended).

## What we kept

| From | Idea | Where it lives now |
|---|---|---|
| Previous project | Org profile drives both search and scoring | `config/forge-profile.json` |
| Previous project | Multi-source connector pattern, dedupe by source-prefixed id | `src/lib/sources/` |
| Previous project | Rule-based eligibility and fit checks before the LLM | `src/lib/screening/criteria.ts` |
| Previous project | Per-scan evaluation cap for cost control | `MAX_EVALUATIONS_PER_SCAN` |
| Previous project | Kanban pipeline, calendar-style deadline views, quick search | `/pipeline`, dashboard |
| Team notes ("Updates for the dashboard") | Separate *Internal Review Due* and *Submission Deadline* boxes | Dashboard |
| Team notes | Matching criteria: no cash match, indirect costs allowed, funds operating expenses, 501(c)(3) lead applicant | Criteria checks + dots |
| Team notes | Federal funding page with DOE, EDA, USDA, Delta Regional Authority, DOL and NSF; no sources list on the dashboard | `/federal` |
| Team notes | "Innovation" keyword; foundations limited to open solicitations | Profile keywords; `open_solicitation` criterion |
| Team notes | Forge's positioning (PM and grant admin first; bridge labs and universities to industry; subcontract the expertise) | Profile summary and Claude's scoring rubric |
| Sample report | 1-10 score; why it fits / proposed project / target clients / recommended partners / why Forge qualifies; recommended, possible and not-recommended tiers | Claude output schema, detail page, `/report` |

## What changed and why

- **Grok → Claude.** The sample report, which the team liked, was produced with Claude. The evaluation uses structured outputs, so it always returns the report's sections and never needs regex JSON parsing (the old `xai-grok.ts` did that).
- **Supabase → JSON file (for now).** The baseline runs with zero setup. The store module has a small interface so it can move to Postgres without touching the pages.
- **Removed** the voice easter egg, the GitHub-API-backed profile editor, the hard-coded family-foundations list, and the SAM.gov, DARPA, DIU and AFWERX scrapers. Each is either a roadmap item below or something to re-add on purpose rather than carry over.
- **Grants.gov detail fetch** is now on every new opportunity. That is where cost sharing, eligibility text and award ranges come from, and the criteria checks depend on it.

## Problems found in the inputs (and handled)

- **Placeholder deadlines.** The sample report listed NSF GRANTED as due 10/02/2076 ("18250 days left"). That date really is in Grants.gov. The app now flags any deadline more than five years out and does not derive an internal review date from it.
- **SBIR/STTR.** These scored high on keywords in the first test scan, but only small business concerns can apply. They are now a blocker.
- **Track-specific eligibility.** Rules like "PI must be tenure-track" often apply to only one track (CyberAI SFS, for example). Blockers are shown and keep the item away from Claude, but they never auto-decline it.
- **Double-encoded HTML** in Grants.gov text (`&amp;nbsp;`) is decoded.

## Roadmap (suggested order)

1. **Database + auth.** Move the store to Postgres (Supabase was already in use) and replace Basic auth with SSO before hosting on Vercel, whose filesystem is read-only.
2. **More sources.** The sample report's best match (RMUC Technical Assistance, 10/10) came from **ConnectWerx**, which is not on Grants.gov. Add, in order of value: ConnectWerx, DOE Infrastructure Exchange, DOE EERE Exchange, ARPA-E, NSF funding pages, the Delta Regional Authority site, SAM.gov (contracts), and open-solicitation foundations.
3. **Read the full notice.** Many criteria come back "not stated" because listings omit indirect cost and operating expense rules. Download the NOFO PDF (Grants.gov attachments) and pass it to Claude for those checks.
4. **Scheduled scans and alerts.** A daily cron, plus a digest of new high matches and upcoming review dates.
5. **Calibrate scoring.** Record each go/no-go with a reason, then compare Claude's scores against the team's decisions and adjust the profile and rubric.
6. **Decision funnel analytics and proposal kickoff** (partner outreach checklist, draft outline from the proposed project).
7. **Profile editing in the UI**, with change history.
