import { describe, expect, it } from "vitest";
import { programAcronym } from "../src/lib/sources/past-awards";

describe("programAcronym", () => {
  it("takes the trailing parenthetical acronym", () => {
    expect(programAcronym("Cybersecurity Innovation for Cyberinfrastructure (CICI)")).toBe("CICI");
    expect(programAcronym("Security, Privacy, and Trust in Cyberspace (NSF SaTC)")).toBe("SaTC");
  });
  it("returns null when the title has none", () => {
    expect(programAcronym("Training-based Workforce Development for Advanced Cyberinfrastructure")).toBeNull();
  });
});
