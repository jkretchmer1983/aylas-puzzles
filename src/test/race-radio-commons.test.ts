import { describe, expect, it } from "vitest";
import { CATALOG_SNAPSHOT, parsePublicCatalog, playableTemplateIds } from "@/lib/public-catalog";
import { installedAdapterForBand } from "@/lib/game-adapters";
import { parseRouteBand } from "@/lib/commons-launch";

const withRecord = (id: string, patch: Record<string, unknown>) => parsePublicCatalog({
  ...CATALOG_SNAPSHOT,
  records: CATALOG_SNAPSHOT.records.map((r) => (r.id === id ? { ...r, ...patch } : r)),
});

describe("Everybody Says They Won (dashboard v1-lineup, ages 5–10)", () => {
  it("is playable for menu bands 2–6 and not for band 1", () => {
    for (const band of [2, 3, 4, 5, 6]) expect(playableTemplateIds(CATALOG_SNAPSHOT, band)).toContain("ordering");
    expect(playableTemplateIds(CATALOG_SNAPSHOT, 1)).not.toContain("ordering");
  });
  it("a band-1 direct link keeps band 1 and is rejected by the gate", () => {
    expect(parseRouteBand(1)).toBe(1);
    expect(installedAdapterForBand("v1-lineup", 1)?.templateId).toBe('ordering');
    expect(playableTemplateIds(CATALOG_SNAPSHOT, 1)).not.toContain('ordering');
  });
  it("is not playable while coming soon or withdrawn", () => {
    expect(playableTemplateIds(withRecord("v1-lineup", { release: "coming-soon" }), 4)).not.toContain("ordering");
    expect(playableTemplateIds(withRecord("v1-lineup", { release: "withdrawn" }), 4)).not.toContain("ordering");
  });
});

describe("The Radio Has Opinions · Symbol Codes (dashboard v1-cipher, ages 6–10)", () => {
  it("is playable for menu bands 3–6 and not for bands 1–2", () => {
    for (const band of [3, 4, 5, 6]) expect(playableTemplateIds(CATALOG_SNAPSHOT, band)).toContain("radio");
    for (const band of [1, 2]) expect(playableTemplateIds(CATALOG_SNAPSHOT, band)).not.toContain("radio");
  });
  it("a band-2 direct link keeps band 2 and is rejected by the gate", () => {
    expect(parseRouteBand(2)).toBe(2);
    expect(installedAdapterForBand("v1-cipher", 2)?.templateId).toBe('radio');
    expect(playableTemplateIds(CATALOG_SNAPSHOT, 2)).not.toContain('radio');
  });
  it("a wider dashboard range widens eligibility beyond informational tested bands", () => {
    expect(playableTemplateIds(withRecord("v1-cipher", { minAge: 4 }), 2)).toContain("radio");
  });
});
