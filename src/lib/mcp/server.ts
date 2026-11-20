/**
 * Forge Grants MCP server: lets Claude (in a Claude Project, Claude Desktop or
 * Claude Code) search Forge's opportunities, pull past awards and winners'
 * abstracts, and coach the team on writing a winning proposal.
 *
 * Served over Streamable HTTP at /api/mcp (see src/app/api/mcp/route.ts) and
 * over stdio by scripts/mcp-stdio.mts.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { fitScore, isOpen } from "../dashboard";
import { agencyForCode, profile } from "../profile";
import { fetchPastAwards, nsfPastAwards, usaspendingPastAwards } from "../sources/past-awards";
import { listOpportunities, getOpportunity } from "../store";
import type { Opportunity } from "../types";

const text = (value: unknown) => ({ content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }] });
const fail = (message: string) => ({ content: [{ type: "text" as const, text: message }], isError: true });
const READ_ONLY = { readOnlyHint: true, openWorldHint: true } as const;

/** Accepts "grants.gov:344608", "gg-344608" (the shared page's id) or "344608". */
function normalizeId(id: string): string {
  const m = id.trim().match(/(\d{5,})$/);
  return m ? `grants.gov:${m[1]}` : id.trim();
}

function roleOf(o: Opportunity): string {
  return o.evaluation?.forgeRole ?? o.screening?.leadRole ?? "unclear";
}

function summary(o: Opportunity) {
  return {
    id: o.id,
    title: o.title,
    agency: o.agency,
    number: o.number,
    deadline: o.closeDate,
    awardCeiling: o.awardCeiling,
    fit: fitScore(o),
    fitSource: o.evaluation ? "Claude evaluation" : "keyword pre-score",
    forgeRole: roleOf(o),
    stage: o.stage,
    pastAwards: o.pastAwards?.awards.length ?? 0,
    url: o.sourceUrl,
  };
}

export function createForgeMcpServer(): McpServer {
  const server = new McpServer(
    { name: "forge-grants", version: "0.1.0" },
    {
      instructions:
        "Grant opportunities screened for Forge Institute (a 501(c)(3) in Little Rock, Arkansas that manages programs and grants and connects national labs and universities with industry and electric utilities). " +
        "Use search_opportunities to find opportunities, get_opportunity for the full listing, get_past_awards and get_award to study what previous winners proposed, and get_forge_profile for Forge's capabilities. " +
        "Full winning proposals are not public; award abstracts (NSF) and award records (USAspending) are. Cite award links when you use them.",
    },
  );

  server.registerTool(
    "search_opportunities",
    {
      title: "Search opportunities",
      description: "Search Forge's screened grant opportunities by text, agency, fit and Forge's role. Returns a compact list; use get_opportunity for details.",
      inputSchema: {
        query: z.string().optional().describe("Words to match in the title, description or opportunity number"),
        agency: z.string().optional().describe("Priority agency id: DOE, EDA, USDA, DRA, DOL, NSF, DHS or DOD"),
        min_fit: z.number().int().min(1).max(10).optional().describe("Minimum fit score, 1-10"),
        role: z.enum(["lead", "partner", "unclear"]).optional().describe("Whether Forge can lead or would partner"),
        include_closed: z.boolean().optional().describe("Include opportunities whose deadline has passed"),
        limit: z.number().int().min(1).max(100).optional().describe("Default 20"),
      },
      annotations: READ_ONLY,
    },
    async ({ query, agency, min_fit, role, include_closed, limit }) => {
      const q = query?.toLowerCase().trim();
      const all = await listOpportunities();
      const items = all
        .filter((o) => include_closed || isOpen(o))
        .filter((o) => !agency || agencyForCode(o.agencyCode)?.id === agency.toUpperCase())
        .filter((o) => !min_fit || (fitScore(o) ?? 0) >= min_fit)
        .filter((o) => !role || roleOf(o) === role || (roleOf(o) === "either" && role !== "unclear"))
        .filter((o) => !q || [o.title, o.description, o.number, o.agency].some((f) => f?.toLowerCase().includes(q)))
        .sort((a, b) => (fitScore(b) ?? 0) - (fitScore(a) ?? 0))
        .slice(0, limit ?? 20)
        .map(summary);
      return text({ count: items.length, opportunities: items });
    },
  );

  server.registerTool(
    "get_opportunity",
    {
      title: "Get opportunity",
      description: "Full details for one opportunity: description, eligibility, Forge's decision criteria, Forge's role, Claude's fit evaluation if any, and past awards under the same program.",
      inputSchema: { id: z.string().describe('Opportunity id, e.g. "grants.gov:344608", "gg-344608" or "344608"') },
      annotations: READ_ONLY,
    },
    async ({ id }) => {
      const o = await getOpportunity(normalizeId(id));
      if (!o) return fail(`No opportunity with id ${id}. Use search_opportunities to find it.`);
      return text({ ...summary(o), description: o.description, eligibility: o.eligibilityText, costSharing: o.costSharing, awardFloor: o.awardFloor, estimatedFunding: o.estimatedFunding,
        expectedAwards: o.expectedAwards, assistanceListings: o.assistanceListings, criteria: o.screening?.criteria, leadReason: o.screening?.leadReason, evaluation: o.evaluation, pastAwards: o.pastAwards });
    },
  );

  server.registerTool(
    "get_past_awards",
    {
      title: "Get past awards",
      description: "Look up previously funded awards live from NSF Award Search (with abstracts) or USAspending.gov. Give an opportunity id, or an Assistance Listing number, or an NSF program name.",
      inputSchema: {
        id: z.string().optional().describe("Opportunity id; matches awards from the same program"),
        assistance_listing: z.string().optional().describe('Assistance Listing (CFDA) number, e.g. "81.122"'),
        nsf_program: z.string().optional().describe('NSF program name or acronym, e.g. "CyberTraining" or "CICI"'),
        limit: z.number().int().min(1).max(25).optional().describe("Default 10"),
      },
      annotations: READ_ONLY,
    },
    async ({ id, assistance_listing, nsf_program, limit }) => {
      try {
        if (id) {
          const o = await getOpportunity(normalizeId(id));
          if (!o) return fail(`No opportunity with id ${id}.`);
          const r = await fetchPastAwards(o);
          return r ? text(r) : fail("No program information to match awards on for this opportunity.");
        }
        if (nsf_program) return text(await nsfPastAwards({ title: `(${nsf_program})` }, limit ?? 10));
        if (assistance_listing) return text(await usaspendingPastAwards([assistance_listing], limit ?? 10));
        return fail("Give an opportunity id, an assistance_listing or an nsf_program.");
      } catch (e) {
        return fail(`Award lookup failed: ${(e as Error).message}. The award databases may be busy; try again shortly.`);
      }
    },
  );

  server.registerTool(
    "get_award",
    {
      title: "Get award details",
      description: "Full public record of one past award: for NSF, the complete project abstract; for USAspending, the award description, recipient, period and amount.",
      inputSchema: {
        source: z.enum(["nsf", "usaspending"]),
        award_id: z.string().describe('NSF award number (e.g. "2611897") or the USAspending generated id from the award URL (e.g. "ASST_NON_DEOE0000780_089")'),
      },
      annotations: READ_ONLY,
    },
    async ({ source, award_id }) => {
      try {
        if (source === "nsf") {
          const res = await fetch(`https://api.nsf.gov/services/v1/awards/${encodeURIComponent(award_id)}.json?printFields=id,title,awardeeName,piFirstName,piLastName,startDate,expDate,estimatedTotalAmt,fundProgramName,abstractText`);
          const award = (await res.json())?.response?.award?.[0];
          if (!award) return fail(`NSF has no award ${award_id}.`);
          return text({ ...award, url: `https://www.nsf.gov/awardsearch/showAward?AWD_ID=${award_id}` });
        }
        const res = await fetch(`https://api.usaspending.gov/api/v2/awards/${encodeURIComponent(award_id)}/`);
        if (!res.ok) return fail(`USAspending has no award ${award_id} (HTTP ${res.status}).`);
        const a = await res.json();
        return text({
          id: a.generated_unique_award_id, description: a.description, recipient: a.recipient?.recipient_name, amount: a.total_obligation,
          start: a.period_of_performance?.start_date, end: a.period_of_performance?.end_date, agency: a.awarding_agency?.subtier_agency?.name,
          assistanceListing: a.cfda_info?.[0]?.cfda_number, programTitle: a.cfda_info?.[0]?.cfda_title, url: `https://www.usaspending.gov/award/${award_id}`,
        });
      } catch (e) {
        return fail(`Award lookup failed: ${(e as Error).message}`);
      }
    },
  );

  server.registerTool(
    "get_forge_profile",
    {
      title: "Get Forge profile",
      description: "Forge Institute's profile: summary, capabilities, partners, good and poor fit, decision criteria and search keywords.",
      annotations: { readOnlyHint: true },
    },
    async () => text(profile),
  );

  server.registerPrompt(
    "coach_proposal",
    {
      title: "Coach a winning proposal",
      description: "Study past winners of an opportunity and coach Forge on how to write a winning proposal.",
      argsSchema: { opportunity_id: z.string().describe('e.g. "gg-344608"') },
    },
    ({ opportunity_id }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `Coach Forge Institute on writing a winning proposal for opportunity ${opportunity_id}.

1. Call get_opportunity and get_forge_profile.
2. Call get_past_awards for this opportunity, then get_award for up to 8 of the awards to read the full abstracts or descriptions.
3. Analyze what the funded projects had in common, how the winners wrote (structure, tone, specificity, how they framed need, approach, partners, evaluation and broader impacts), and what the solicitation's review criteria reward.
4. Give me, in this order:
   - The single most important thing to get right
   - What the winners had in common
   - Writing style: what they did, and what we should do
   - What reviewers reward
   - A suggested outline, section by section, tailored to Forge (note whether Forge should lead or partner)
   - Forge's strongest angles
   - Pitfalls to avoid
   - An original example opening paragraph for Forge (never copy a winner's text)
Cite the award links you relied on. Full winning proposals aren't public, so say when a conclusion rests on abstracts alone.`,
        },
      }],
    }),
  );

  server.registerPrompt(
    "review_draft",
    {
      title: "Review our draft against past winners",
      description: "Compare a draft section of Forge's proposal with what past winners did and the solicitation's criteria, and suggest specific edits.",
      argsSchema: {
        opportunity_id: z.string(),
        draft: z.string().describe("The draft text to review"),
      },
    },
    ({ opportunity_id, draft }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `Review this draft from Forge Institute's proposal for opportunity ${opportunity_id}. First call get_opportunity, get_forge_profile and get_past_awards, and read the full abstracts of the most relevant past awards with get_award. Then tell me: what's working, where it falls short of what the winners did and what the reviewers reward, and specific line edits. Keep Forge's voice: plain, concrete, and specific about utilities, labs and outcomes. Cite the awards you compare against.

Draft:
<<<
${draft}
>>>`,
        },
      }],
    }),
  );

  return server;
}
