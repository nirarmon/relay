import { describe, it, expect } from "vitest";
import { suggestIschemicBudgetMinutes } from "./create-mission-action";

describe("suggestIschemicBudgetMinutes", () => {
  it("gives a longer window for machine perfusion than static cold, same organ", () => {
    const staticCold = suggestIschemicBudgetMinutes("KIDNEY", "STATIC_COLD");
    const machinePerfusion = suggestIschemicBudgetMinutes("KIDNEY", "MACHINE_PERFUSION");
    expect(machinePerfusion).toBeGreaterThan(staticCold);
  });

  it("gives a much shorter window for a heart than a kidney", () => {
    expect(suggestIschemicBudgetMinutes("HEART", "STATIC_COLD")).toBeLessThan(
      suggestIschemicBudgetMinutes("KIDNEY", "STATIC_COLD")
    );
  });
});
