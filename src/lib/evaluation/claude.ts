import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { formatMoney } from "../dates";
import { profileAsPrompt } from "../profile";
import type { Evaluation, Opportunity } from "../types";

export const EVALUATION_MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

const EvaluationSchema = z.object({
  score: z.number().int().min(1).max(10).describe("Fit for Forge, 1-10"),
  whyItFits: z.string().describe("2-4 sentences. Say plainly when it does not fit."),
  proposedProject: z.string().describe("The project Forge would propose, naming Forge's role and the partners' roles. Empty if score <= 3."),
  targetClients: z.string().describe("Who would receive the services or training."),
  recommendedPartners: z.array(z.string()).describe("Specific partners, each with a short reason."),
  whyForgeQualifies: z.string().describe("Eligibility reasoning tied to the notice's eligibility text. Flag anything to confirm."),
  risks: z.array(z.string()).describe("Eligibility gaps, cost share, deadline, or capacity risks."),
  forgeRole: z.enum(["lead", "partner", "either"]).describe("lead: Forge can be the lead applicant. partner: Forge can only join an eligible lead as partner/subrecipient/subcontractor. either: both are open."),
  roleRationale: z.string().describe("One or two sentences on why, citing the eligibility text, and who would lead if Forge partners."),
});

const SYSTEM = `You are the grant strategist for Forge Institute. You decide which federal funding opportunities Forge should pursue and sketch how Forge would pursue them.

${profileAsPrompt()}

How to score (1-10):
Forge does NOT have to be the lead applicant. Score the fit of the work itself, whether Forge would lead or join a university, lab or company as a partner or subrecipient, and report the role separately in forgeRole.
- 9-10: The topic is core (energy-sector cyber, utilities, workforce, lab/university-to-industry bridging) and the program rewards what Forge does: program management, convening, intermediary or technical-assistance roles.
- 6-8: Real topic fit and a clear, funded role for Forge as lead or partner.
- 4-5: Thin topic fit, or Forge's role would be small.
- 1-3: Outside Forge's domains (basic science, individual fellowships), or Forge has no possible role (e.g. invitation only).

Rules:
- Ground eligibility claims in the eligibility text you are given. If it is missing, say what needs to be confirmed. Do not assume.
- Forge's value is program management, grant administration, and connecting sectors. Do not claim deep in-house technical research capability.
- Be direct. A low score with a clear reason is more useful than a hedged middle score.`;

function opportunityPrompt(o: Opportunity): string {
  const crit = o.screening?.criteria.map((c) => `- ${c.label}: ${c.status} (${c.evidence})`).join("\n") ?? "";
  return [
    `Title: ${o.title}`,
    `Agency: ${o.agency ?? "Unknown"} (${o.agencyCode ?? "?"})`,
    `Opportunity number: ${o.number ?? "N/A"}`,
    `Deadline: ${o.closeDate ?? "Not stated"}`,
    `Award: floor ${formatMoney(o.awardFloor)}, ceiling ${formatMoney(o.awardCeiling)}, total ${formatMoney(o.estimatedFunding)}, expected awards ${o.expectedAwards ?? "?"}`,
    `Cost sharing required: ${o.costSharing === null ? "not stated" : o.costSharing ? "yes" : "no"}`,
    `\nEligibility:\n${o.eligibilityText ?? "Not provided"}`,
    `\nDescription:\n${o.description ?? "Not provided"}`,
    crit ? `\nAutomated criteria checks (verify, do not trust blindly):\n${crit}` : "",
  ].join("\n");
}

export function tierFor(score: number): Evaluation["tier"] {
  if (score >= 8) return "strong";
  if (score >= 6) return "good";
  if (score >= 4) return "possible";
  return "poor";
}

export function isClaudeConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

export async function evaluateWithClaude(o: Opportunity, client = new Anthropic()): Promise<Evaluation> {
  const response = await client.beta.messages.parse({
    model: EVALUATION_MODEL,
    max_tokens: 16000,
    // If a safety classifier declines, the API retries on its default fallback model.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: { effort: "medium", format: betaZodOutputFormat(EvaluationSchema) },
    system: SYSTEM,
    messages: [{ role: "user", content: opportunityPrompt(o) }],
  });

  if (response.stop_reason === "refusal") throw new Error("Claude declined to evaluate this opportunity");
  if (response.stop_reason === "max_tokens") throw new Error("Evaluation was cut off (max_tokens)");
  const parsed = response.parsed_output;
  if (!parsed) throw new Error("Claude returned no structured output");

  return {
    ...parsed,
    tier: tierFor(parsed.score),
    model: response.model,
    evaluatedAt: new Date().toISOString(),
  };
}
