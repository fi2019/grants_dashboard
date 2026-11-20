import { describe, expect, it } from "vitest";
import { evaluateCriteria, screen } from "../src/lib/screening/criteria";
import { isImplausibleDeadline, daysUntil, parseUsDate } from "../src/lib/dates";

const base = { title: "", description: null, eligibilityText: null, costSharing: null, closeDate: null, agency: null };
const byId = (r: ReturnType<typeof evaluateCriteria>, id: string) => r.find((c) => c.id === id)!;

describe("decision criteria", () => {
  it("reads cost sharing from the structured field", () => {
    expect(byId(evaluateCriteria({ ...base, costSharing: false }), "no_cash_match").status).toBe("pass");
    expect(byId(evaluateCriteria({ ...base, costSharing: true }), "no_cash_match").status).toBe("fail");
  });

  it("detects a match requirement in text even when the field is missing", () => {
    const r = evaluateCriteria({ ...base, description: "Applicants must provide a 20% cash match." });
    expect(byId(r, "no_cash_match").status).toBe("fail");
  });

  it("marks Forge as able to lead when nonprofits are listed", () => {
    const r = evaluateCriteria({ ...base, eligibilityText: "Nonprofits having a 501(c)(3) status with the IRS" });
    expect(byId(r, "lead_eligible").status).toBe("pass");
  });

  it("marks a partner role (not a rejection) when only IHEs may apply", () => {
    const r = evaluateCriteria({ ...base, eligibilityText: "Proposals may only be submitted by accredited institutions of higher education." });
    expect(byId(r, "lead_eligible").status).toBe("fail");
  });

  it("treats 'Others (see text)' as unknown, not a pass", () => {
    const r = evaluateCriteria({ ...base, eligibilityText: 'Others (see text field entitled "Additional Information on Eligibility")' });
    expect(byId(r, "lead_eligible").status).toBe("unknown");
  });

  it("flags invitation-only programs", () => {
    const r = evaluateCriteria({ ...base, description: "This program is by invitation only." });
    expect(byId(r, "open_solicitation").status).toBe("fail");
  });
});

describe("screen", () => {
  it("scores a core-fit utility cybersecurity program above an off-topic one", () => {
    const fit = screen({
      ...base,
      title: "Rural and Municipal Utility Advanced Cybersecurity Technical Assistance",
      description: "Nonprofit intermediary to provide technical assistance and OT/ICS training to rural electric cooperatives.",
      eligibilityText: "Nonprofits",
      costSharing: false,
    });
    const off = screen({ ...base, title: "Plant Genome Research Program", description: "Plant biology and genomics research." });
    expect(fit.preScore).toBeGreaterThanOrEqual(70);
    expect(off.preScore).toBeLessThan(30);
    expect(fit.signals).toContain("Utilities");
  });

  it("treats a tenure-track PI rule as a partner role, not a blocker", () => {
    const s = screen({ ...base, title: "X", eligibilityText: "The PI must hold a tenure-track faculty position." });
    expect(s.blockers).toEqual([]);
    expect(s.leadRole).toBe("partner");
  });
});

describe("dates", () => {
  it("parses grants.gov dates", () => {
    expect(parseUsDate("04/05/2027")).toBe("2027-04-05T23:59:00.000Z");
    expect(parseUsDate("")).toBeNull();
  });

  it("flags placeholder deadlines like the 2076 one in the sample report", () => {
    const now = new Date("2026-10-15T00:00:00Z");
    expect(isImplausibleDeadline("2076-10-02T00:00:00Z", now)).toBe(true);
    expect(isImplausibleDeadline("2027-04-05T00:00:00Z", now)).toBe(false);
    expect(daysUntil("2026-10-20T23:59:00Z", now)).toBe(5);
    expect(daysUntil("2026-10-15T23:59:00Z", new Date("2026-10-15T18:00:00Z"))).toBe(0);
  });
});

describe("blockers", () => {
  it("SBIR/STTR: Forge can't lead but can partner with the small business", () => {
    const s = screen({ ...base, title: "Small Business Innovation Research / Small Business Technology Transfer Phase I" });
    expect(s.blockers).toEqual([]);
    expect(s.leadRole).toBe("partner");
  });

  it("does not lower the pre-score just because Forge can't lead", () => {
    const desc = "Workforce training for rural electric cooperatives on cybersecurity.";
    const lead = screen({ ...base, title: "T", description: desc, eligibilityText: "Nonprofits" });
    const partner = screen({ ...base, title: "T", description: desc, eligibilityText: "Proposals may only be submitted by accredited institutions of higher education." });
    expect(partner.leadRole).toBe("partner");
    expect(lead.preScore - partner.preScore).toBeLessThanOrEqual(3);
  });

  it("still rules out invitation-only programs", () => {
    expect(screen({ ...base, title: "X", description: "Applications by invitation only." }).blockers).toContain("Invitation only");
  });
});

import { decodeEntities, stripHtml } from "../src/lib/sources/grants-gov";
describe("grants.gov text cleanup", () => {
  it("decodes single and double-encoded entities", () => {
    expect(decodeEntities("DHS S&amp;T")).toBe("DHS S&T");
    expect(decodeEntities("Veterans&rsquo; Program")).toBe("Veterans’ Program");
    expect(stripHtml("<p>one&amp;nbsp;two&#39;s</p>")).toBe("one two's");
  });
});
