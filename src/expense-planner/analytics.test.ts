import { describe, expect, it } from "vitest";
import { buildDefaultExpensePlan } from "./defaults.js";
import {
  budgetForDuration,
  budgetUsedPercent,
  buildRedFlags,
  monthlyBudgetTotal,
  projectedMonthlyPace,
} from "./analytics.js";

describe("monthlyBudgetTotal", () => {
  it("sums visible category budgets only", () => {
    const plan = buildDefaultExpensePlan("hh-1");
    plan.categories.find((c) => c.category === "food")!.monthlyBudget = 500;
    plan.categories.find((c) => c.category === "housing")!.monthlyBudget = 2000;
    expect(monthlyBudgetTotal(plan.categories)).toBe(2500);
  });
});

describe("budgetForDuration", () => {
  it("scales for multi-month presets", () => {
    expect(budgetForDuration("last-3-months", 1000)).toBe(3000);
    expect(budgetForDuration("last-year", 1000)).toBe(12000);
    expect(budgetForDuration("current-month", 1000)).toBe(1000);
  });
});

describe("budgetUsedPercent", () => {
  it("caps at 150%", () => {
    expect(budgetUsedPercent(2000, 1000)).toBe(150);
    expect(budgetUsedPercent(500, 1000)).toBe(50);
  });
});

describe("buildRedFlags", () => {
  it("flags over total budget", () => {
    const plan = buildDefaultExpensePlan("hh-1");
    const flags = buildRedFlags({
      totalSpend: 6000,
      budgetForRange: 5000,
      budgetUsedPct: 120,
      duration: "current-month",
      rangeLabel: "June 2026",
      spendByCategory: {},
      categories: plan.categories,
      unmappedCount: 0,
      unmappedAmount: 0,
      dayOfMonth: 15,
    });
    expect(flags.some((f) => f.title === "Over total budget")).toBe(true);
  });
});

describe("projectedMonthlyPace", () => {
  it("extrapolates from month progress", () => {
    expect(projectedMonthlyPace(500, 15, 30)).toBeCloseTo(1000, 0);
  });
});
