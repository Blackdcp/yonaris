import { describe, expect, it } from "vitest";
import { productDemoFor } from "./product-demo";

describe("public product demo content", () => {
  it("uses only fixture-backed headline figures", () => {
    const en = productDemoFor("en");
    expect(en.overview).toMatchObject({ visibility: 79, share: 35, prompts: 42, evaluations: 3120 });
    expect(en.shareOfVoice.rows.map((row) => row.brand)).toEqual(["Your brand", "Competitor A", "Competitor B", "Competitor C"]);
    expect(en.shareOfVoice.rows.every((row) => Object.keys(row).every((key) => key === "brand"))).toBe(true);
  });

  it("qualifies the evaluation total with its window and approximate daily frequency", () => {
    const en = productDemoFor("en");
    const zh = productDemoFor("zh");
    expect(en.overview.evaluationWindow).toContain("30-day");
    expect(en.overview.frequencyNote).toMatch(/approximately.*day/i);
    expect(zh.overview.evaluationWindow).toContain("30 天");
    expect(zh.overview.frequencyNote).toMatch(/约.*每天/u);
  });

  it("localizes the Chinese evidence rather than wrapping English prompts", () => {
    const zh = productDemoFor("zh");
    expect(zh.labels.sampleWorkspace).toContain("示例工作区");
    expect(zh.queryFanOut.prompt).toMatch(/[\u4e00-\u9fff]/u);
    expect(zh.queryFanOut.prompt).not.toContain("What should");
  });
});
