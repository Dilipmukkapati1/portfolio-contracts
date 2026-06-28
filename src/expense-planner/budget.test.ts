import { describe, expect, it } from "vitest";
import {
  applyPercentToCategory,
  allocatedBudgetTotal,
  planBudgetCategories,
} from "./budget.js";
import { buildDefaultExpensePlan, normalizeExpensePlan } from "./defaults.js";

describe("planBudgetCategories", () => {
  it("shows standard expense categories by default", () => {
    const plan = buildDefaultExpensePlan("hh-1");
    const rows = planBudgetCategories(plan.categories);
    const ids = rows.map((c) => c.category);
    expect(ids).toContain("housing");
    expect(ids).toContain("food");
    expect(ids).not.toContain("income");
    expect(ids).not.toContain("transfer");
  });
});

describe("normalizeExpensePlan", () => {
  it("restores standard categories when plan is mostly hidden", () => {
    const broken = buildDefaultExpensePlan("hh-1");
    broken.categories = broken.categories.map((c) => ({
      ...c,
      hidden: !["taxes", "fees"].includes(c.category),
    }));
    const fixed = normalizeExpensePlan(broken);
    const visible = planBudgetCategories(fixed.categories).map((c) => c.category);
    expect(visible).toContain("housing");
    expect(visible).toContain("food");
    expect(visible.length).toBeGreaterThan(5);
  });
});

describe("percent allocation", () => {
  it("derives dollar budget from total and percent", () => {
    const plan = buildDefaultExpensePlan("hh-1");
    const food = plan.categories.find((c) => c.category === "food")!;
    const updated = applyPercentToCategory({ ...food, hidden: false }, 25, 4000);
    expect(updated.monthlyBudget).toBe(1000);
    expect(updated.budgetPercent).toBe(25);
  });

  it("sums allocated budgets in percent mode", () => {
    const plan = buildDefaultExpensePlan("hh-1");
    const categories = plan.categories.map((c) =>
      c.category === "food"
        ? applyPercentToCategory({ ...c, hidden: false }, 40, 5000)
        : c.category === "housing"
          ? applyPercentToCategory({ ...c, hidden: false }, 60, 5000)
          : { ...c, hidden: true }
    );
    expect(allocatedBudgetTotal(categories, 5000, "percent")).toBe(5000);
  });
});
