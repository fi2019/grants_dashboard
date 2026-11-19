import profileJson from "../../config/forge-profile.json";

export interface FederalAgency {
  id: string;
  name: string;
  grantsGovPrefixes: string[];
  url: string;
}

export type OrgProfile = typeof profileJson & { federalAgencies: FederalAgency[] };

/** The Forge profile is a checked-in config file so changes are reviewed like code. */
export const profile: OrgProfile = profileJson;

/** Plain-text profile used in the Claude system prompt. */
export function profileAsPrompt(p: OrgProfile = profile): string {
  const list = (items: string[]) => items.map((i) => `- ${i}`).join("\n");
  return [
    `# ${p.organization}`,
    p.summary,
    `Entity type: ${p.identity.entityType}. Location: ${p.identity.location}. Service area: ${p.identity.serviceArea}.`,
    `## Capabilities\n${list(p.capabilities)}`,
    `## Partners\n${list(p.partners)}`,
    `## Track record\n${list(p.trackRecord)}`,
    `## Good fit\n${list(p.goodFit)}`,
    `## Poor fit\n${list(p.poorFit)}`,
  ].join("\n\n");
}

export function agencyForCode(code: string | null | undefined): FederalAgency | null {
  if (!code) return null;
  const upper = code.toUpperCase();
  return (
    profile.federalAgencies.find((a) =>
      a.grantsGovPrefixes.some((p) => upper === p || upper.startsWith(`${p}-`)),
    ) ?? null
  );
}
