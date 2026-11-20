import { describe, expect, it } from "vitest";
import { classifyMechanisms } from "../src/lib/screening/mechanism";

const base = { number: null, description: null, status: "posted" as const };

describe("classifyMechanisms", () => {
  it("labels SBIR/STTR and keeps the funding instrument", () => {
    expect(classifyMechanisms({ ...base, title: "Small Business Innovation Research / Small Business Technology Transfer Phase I", fundingInstruments: ["G"] }))
      .toEqual(["SBIR", "STTR", "Grant"]);
  });
  it("labels BAAs", () => {
    expect(classifyMechanisms({ ...base, title: "NRL Long Range Broad Agency Announcement (BAA) for Basic and Applied Research", fundingInstruments: ["G", "CA"] }))
      .toEqual(["BAA", "Grant", "Cooperative agreement"]);
  });
  it("doesn't read operational technology (OT) as Other Transaction", () => {
    expect(classifyMechanisms({ ...base, title: "OT cybersecurity training for utilities", fundingInstruments: ["G"] })).toEqual(["Grant"]);
    expect(classifyMechanisms({ ...base, title: "Prototype", description: "Awards will be Other Transaction agreements." })).toEqual(["OT"]);
  });
  it("marks forecasts, notices of intent and contracts", () => {
    expect(classifyMechanisms({ ...base, title: "NOI: PROSPECT Program", status: "forecasted", fundingInstruments: ["PC"] }))
      .toEqual(["Notice of intent", "Forecast", "Contract"]);
  });
});

describe("passing mentions", () => {
  it("doesn't label a program SBIR because its description mentions SBIR", () => {
    expect(classifyMechanisms({ ...base, title: "Sociology", description: "Proposals for SBIR funding should go to the SBIR program.", fundingInstruments: ["G"] })).toEqual(["Grant"]);
  });
});
