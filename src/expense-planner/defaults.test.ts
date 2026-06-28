import { describe, expect, it } from "vitest";
import {
  buildDefaultExpensePlan,
  categoryDisplayLabel,
  normalizeExpensePlan,
  visibleCategories,
} from "./defaults.js";
import { planBudgetCategories } from "./budget.js";

describe("buildDefaultExpensePlan", () => {
  it("creates plan with all enum categories", () => {
    const plan = buildDefaultExpensePlan("hh-1");
    expect(plan.id).toBe("expense-plan-hh-1");
    expect(plan.householdId).toBe("hh-1");
    expect(plan.categories.length).toBe(16);
    expect(plan.mappingRules).toEqual([]);
  });

  it("hides income, transfer, investment by default", () => {
    const plan = buildDefaultExpensePlan("hh-1");
    const hidden = plan.categories.filter((c) => c.hidden).map((c) => c.category);
    expect(hidden).toContain("income");
    expect(hidden).toContain("transfer");
    expect(hidden).toContain("investment");
  });
});

describe("visibleCategories", () => {
  it("filters hidden categories", () => {
    const plan = buildDefaultExpensePlan("hh-1");
    const visible = visibleCategories(plan.categories);
    expect(visible.every((c) => !c.hidden)).toBe(true);
    expect(visible.length).toBeGreaterThan(5);
    expect(planBudgetCategories(plan.categories).length).toBeGreaterThan(5);
  });
});

describe("categoryDisplayLabel", () => {
  it("uses custom label when set", () => {
    const plan = buildDefaultExpensePlan("hh-1");
    const food = plan.categories.find((c) => c.category === "food")!;
    food.label = "Groceries";
    expect(categoryDisplayLabel("food", plan.categories)).toBe("Groceries");
  });
});
