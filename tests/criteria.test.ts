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

  it("passes 501(c)(3) eligibility when nonprofits are listed", () => {
    const r = evaluateCriteria({ ...base, eligibilityText: "Nonprofits having a 501(c)(3) status with the IRS" });
    expect(byId(r, "lead_eligible").status).toBe("pass");
  });

  it("fails lead eligibility when only IHEs may apply", () => {
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

  it("records blockers for tenure-track PI requirements", () => {
    const s = screen({ ...base, title: "X", eligibilityText: "The PI must hold a tenure-track faculty position." });
    expect(s.blockers).toContain("Requires a tenured or tenure-track PI");
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
  it("blocks SBIR/STTR (nonprofits cannot be the small business concern)", () => {
    expect(screen({ ...base, title: "Small Business Innovation Research / Small Business Technology Transfer Phase I" }).blockers)
      .toContain("SBIR/STTR: small business concerns only");
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
