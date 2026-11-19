# Forge Grants

Grant discovery and go/no-go decision dashboard for Forge Institute. It pulls open federal opportunities, screens them against Forge's decision criteria, has Claude write a fit analysis for the promising ones, and tracks each one through internal review to submission.

This is a **baseline**. It is meant to be refined, not deployed as is. See [docs/baseline-notes.md](docs/baseline-notes.md) for what was carried over from the previous project, what changed, and the roadmap.

## Quick start

```bash
npm install
npm run dev            # http://localhost:3000
```

The app starts with `data/seed.json`: a Grants.gov snapshot from 2026-11-19 (369 open opportunities). Ten of them carry evaluations transcribed from the October 15, 2026 sample report, labeled as such on the page. Your first change (a scan or a decision) writes `data/opportunities.json`, which is gitignored.

To pull fresh data:

```bash
cp .env.example .env.local     # add ANTHROPIC_API_KEY for Claude evaluations (optional)
npm run scan                   # or click "Run scan" on the dashboard
```

Without `ANTHROPIC_API_KEY`, the scan still fetches and screens everything. Fit scores are then keyword pre-scores, shown with an asterisk (`5/10*`).

## How it works

```
Grants.gov API ──► fetch details ──► screen (rules) ──► Claude evaluation ──► store ──► dashboard / pipeline / report
 (keywords +        (description,     pre-score 0-100,    1-10 score, why it      JSON file
  agency sweep)      eligibility,      5 decision          fits, proposed project,
                     cost share)       criteria, blockers  partners, risks
```

| Step | File | Notes |
|---|---|---|
| Forge profile | `config/forge-profile.json` | Who Forge is, good/poor fit, keywords, priority agencies, review lead time. Both the rules and Claude read this. |
| Sources | `src/lib/sources/` | Grants.gov only for now. Each source implements `SourceConnector`. |
| Screening | `src/lib/screening/criteria.ts` | The five criteria from the team's notes (501(c)(3) lead applicant, no cash match, indirect costs, operating expenses, open solicitation), topic signals, and hard blockers such as SBIR/STTR or tenure-track PI rules. |
| Evaluation | `src/lib/evaluation/claude.ts` | Structured output with the same sections as the sample report. Only opportunities with no blockers and a pre-score of 40 or more are sent, capped at 15 per scan (`MIN_PRESCORE_FOR_EVALUATION`, `MAX_EVALUATIONS_PER_SCAN`). |
| Storage | `src/lib/store/index.ts` | A single JSON file. Scans never overwrite Forge's stage, owner, notes or review date. |

### Pages

- **Dashboard**: open count, high matches, separate *internal review due* and *submission deadline* boxes, top recommended, decision funnel, quick search.
- **Opportunities**: filter by fit, agency, stage, "no failed criteria", text search. Dots show the five criteria at a glance.
- **Opportunity detail**: criteria with the evidence text they matched, Claude's analysis, the listing's eligibility and description, and a decision panel (Go / No-go, stage, internal review date, owner, notes, re-evaluate).
- **Pipeline**: kanban from Screening to Submitted.
- **Federal funding**: grouped by the priority agencies (DOE, EDA, USDA, Delta Regional Authority, DOL, NSF, DHS, DOD).
- **Report**: printable version of the sample report layout (recommended / possible / not recommended). Use the browser's "Save as PDF".
- **Forge profile**: read-only view of the config.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build && npm start` | Production build |
| `npm run scan` | Scan from the CLI. `-- --max-evaluations 5` limits Claude calls. |
| `npm test` | Unit tests (criteria, dates, dashboard stats) |
| `npm run lint` | Type-check |

## Configuration

See `.env.example`. `DASHBOARD_PASSWORD` turns on HTTP Basic auth for every page. `CRON_SECRET` lets a scheduler call `POST /api/scan` with `Authorization: Bearer <secret>`.

## Refining the scoring

1. Change who Forge is or what counts as a fit in `config/forge-profile.json`. Claude's prompt is built from it.
2. Tune keyword weights, blockers and criteria patterns in `src/lib/screening/criteria.ts`, and add a test in `tests/criteria.test.ts` for each change.
3. Re-evaluate a single opportunity from its detail page to compare.

The pre-score is a coarse filter that decides what is worth sending to Claude. It is not a recommendation.
