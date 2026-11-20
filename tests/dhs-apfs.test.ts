import { describe, expect, it } from "vitest";
import { dollarCeiling, parseCsv, toOpportunity } from "../src/lib/sources/dhs-apfs";
import { screen } from "../src/lib/screening/criteria";
import { classifyMechanisms } from "../src/lib/screening/mechanism";

describe("DHS forecast connector", () => {
  it("parses quoted CSV fields with commas, quotes and newlines", () => {
    const rows = parseCsv('APFS Number,Title,Description\nF1,"Cyber, Ops","Line one\nline ""two"""\n');
    expect(rows).toEqual([{ "APFS Number": "F1", Title: "Cyber, Ops", Description: 'Line one\nline "two"' }]);
  });
  it("reads the top of a dollar range", () => {
    expect(dollarCeiling("$10M - $19M")).toBe(19_000_000);
    expect(dollarCeiling("$500K - $999K")).toBe(999_000);
    expect(dollarCeiling("")).toBeNull();
  });
  it("maps a forecast to a contract opportunity and marks set-asides as partner role", () => {
    const o = toOpportunity({ "APFS Number": "F2026074886", Title: "NICCS Website", Component: "CISA", NAICS: "541512 - Computer Systems Design", Description: "Cybersecurity careers site.", "Dollar Range": "$5M - $9.9M", "Small Business Set-Aside": "Full", "Forecast Published": "2026-11-09" }, "2026-11-20T00:00:00Z");
    expect(o.id).toBe("dhs-apfs:F2026074886");
    expect(o.awardCeiling).toBe(9_900_000);
    expect(classifyMechanisms(o as never)).toEqual(["Forecast", "Contract"]);
    expect(screen(o).leadRole).toBe("partner");
  });
});
