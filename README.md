# Forge Grants

Grant discovery and go/no-go decision dashboard for Forge Institute. It pulls open federal opportunities, screens them against Forge's decision criteria, has Claude write a fit analysis for the promising ones, and tracks each one through internal review to submission.

This is a **baseline**. It is meant to be refined, not deployed as is. See [docs/baseline-notes.md](docs/baseline-notes.md) for what was carried over from the previous project, what changed, and the roadmap.

## Hosted version (claude.ai)

The team view is published as a private claude.ai page: https://claude.ai/artifact/FrxnW51wxBrfZubZJkxu4r

It shows the latest data snapshot. Team-editable lists live in the page's shared store, not in this repo:

- **Categories**: keyword groups with assigned team members. Matching opportunities are tagged and appear under "Your categories" on each member's dashboard.
- **Partners**: labs, universities, researchers and program areas, with a link and focus areas. Opportunities that mention a partner's focus areas are flagged as possible joint submissions.
- **Sources**: the 77-source Federal Funding Sources Catalog (`docs/Federal_Funding_Sources_Catalog.xlsx`, also as `config/sources-catalog.json`) plus team additions: category, API availability, funding mechanisms, focus areas, white-paper path and status. Websites and databases to check, with an optional API URL and the *name* of the API key. Keys are never stored on the page; they go in the scanner's environment under that name.
- **Search keywords**: team additions on the Forge profile tab, on top of `config/forge-profile.json`. Go/No-go decisions, owners, notes and review dates entered there are shared by everyone the page is shared with. It cannot run scans. To refresh it, run `npm run scan`, then `python3 hosted/build-data.py`, then republish `hosted/index.html` with `hosted/opportunities.json` and `hosted/meta.json` to the same URL.

## Claude Project connector (MCP)

The app includes an MCP server so Claude can work with Forge's opportunities inside a Claude Project, Claude Desktop or Claude Code.

| Tool | What it does |
|---|---|
| `search_opportunities` | Search screened opportunities by text, agency, fit and Forge's role (lead or partner) |
| `get_opportunity` | Full listing, decision criteria, Claude's evaluation and past awards |
| `get_past_awards` | Live lookup of previously funded awards (NSF Award Search with abstracts, or USAspending.gov by Assistance Listing) |
| `get_award` | One award's full public record (NSF abstract or USAspending description) |
| `get_forge_profile` | Forge's capabilities, partners and fit criteria |

Prompts: `coach_proposal` (study past winners and coach a winning proposal) and `review_draft` (compare a draft section with past winners and the solicitation).

**In a Claude Project (claude.ai):** deploy the app (for example to Vercel; the MCP endpoint only reads data, so it works on a read-only filesystem), set `MCP_ACCESS_KEY` to a long random string, then add a custom connector in claude.ai Settings → Connectors with the URL `https://<your-host>/api/mcp?key=<MCP_ACCESS_KEY>`. Enable it in the project and ask, for example, "Use coach_proposal for gg-344608."

**In Claude Desktop or Claude Code (local):** run `npm run mcp` as a stdio server. Desktop config:

```json
{ "mcpServers": { "forge-grants": { "command": "npm", "args": ["run", "--silent", "mcp", "--prefix", "/path/to/grants_dashboard"] } } }
```

Full winning proposals are not public. The tools use what is: NSF project abstracts and USAspending award records.

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
