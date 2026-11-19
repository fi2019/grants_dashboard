import { describe, expect, it } from "vitest";
import { computeStats } from "../src/lib/dashboard";
import type { Opportunity } from "../src/lib/types";

const now = new Date("2026-11-19T12:00:00Z");
function opp(p: Partial<Opportunity>): Opportunity {
  return {
    id: Math.random().toString(), source: "grants.gov", sourceUrl: null, number: null, title: "t", agency: null, agencyCode: null,
    description: null, eligibilityText: null, costSharing: null, awardFloor: null, awardCeiling: null, estimatedFunding: null,
    expectedAwards: null, postedDate: null, closeDate: null, status: "posted", fetchedAt: now.toISOString(), screening: null,
    evaluation: null, stage: "new", internalReviewDate: null, owner: null, notes: "", updatedAt: now.toISOString(), ...p,
  };
}
const ev = (score: number) => ({ score, tier: "good" as const, whyItFits: "", proposedProject: "", targetClients: "", recommendedPartners: [], whyForgeQualifies: "", risks: [], model: "m", evaluatedAt: "" });

describe("computeStats", () => {
  it("counts internal review and submission deadlines separately", () => {
    const stats = computeStats([
      opp({ stage: "internal_review", internalReviewDate: "2026-11-25T00:00:00Z", closeDate: "2026-12-09T00:00:00Z", evaluation: ev(8) }),
      opp({ stage: "new", closeDate: "2026-12-01T00:00:00Z", evaluation: ev(3) }),
      opp({ stage: "new", closeDate: "2026-12-01T00:00:00Z", evaluation: ev(7) }),
      opp({ stage: "declined", closeDate: "2026-12-01T00:00:00Z", evaluation: ev(9) }),
      opp({ stage: "new", closeDate: "2026-10-01T00:00:00Z", evaluation: ev(9) }),
    ], now);
    expect(stats.open).toBe(3);
    expect(stats.highMatch).toBe(2);
    expect(stats.internalReviewDue).toHaveLength(1);
    expect(stats.submissionDeadlines).toHaveLength(2);
  });
});
