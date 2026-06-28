import type { TransactionCategory } from "../enums.js";
import type {
  ExpenseBudgetAllocationMode,
  ExpenseCategoryPreference,
  ExpensePlan,
} from "../dtos/expensePlan.js";
import { isExpenseCategory } from "./filters.js";

/** Core buckets shown in the expense plan form by default. */
export const STANDARD_PLAN_CATEGORIES: TransactionCategory[] = [
  "housing",
  "utilities",
  "food",
  "transport",
  "healthcare",
  "insurance",
  "entertainment",
  "shopping",
  "education",
  "other",
];

/** Optional expense buckets the user can add to the plan. */
export const OPTIONAL_PLAN_CATEGORIES: TransactionCategory[] = [
  "taxes",
  "fees",
  "uncategorized",
];

export function planBudgetCategories(
  categories: ExpenseCategoryPreference[]
): ExpenseCategoryPreference[] {
  const byId = new Map(categories.map((c) => [c.category, c]));
  const ordered: ExpenseCategoryPreference[] = [];

  for (const id of STANDARD_PLAN_CATEGORIES) {
    const row = byId.get(id);
    if (row && !row.hidden) ordered.push(row);
  }
  for (const id of OPTIONAL_PLAN_CATEGORIES) {
    const row = byId.get(id);
    if (row && !row.hidden) ordered.push(row);
  }
  for (const row of categories) {
    if (!isExpenseCategory(row.category)) continue;
    if (row.hidden) continue;
    if (ordered.some((c) => c.category === row.category)) continue;
    ordered.push(row);
  }
  return ordered;
}

export function optionalHiddenPlanCategories(
  categories: ExpenseCategoryPreference[]
): ExpenseCategoryPreference[] {
  return categories.filter(
    (c) =>
      c.hidden &&
      isExpenseCategory(c.category) &&
      OPTIONAL_PLAN_CATEGORIES.includes(c.category)
  );
}

export function effectiveCategoryBudget(
  category: ExpenseCategoryPreference,
  monthlyExpenseTotal: number,
  mode: ExpenseBudgetAllocationMode
): number {
  if (mode === "percent" && monthlyExpenseTotal > 0) {
    const pct = category.budgetPercent ?? 0;
    return Math.round((monthlyExpenseTotal * pct) / 100);
  }
  return category.monthlyBudget;
}

export function allocatedBudgetTotal(
  categories: ExpenseCategoryPreference[],
  monthlyExpenseTotal: number,
  mode: ExpenseBudgetAllocationMode
): number {
  return planBudgetCategories(categories).reduce(
    (sum, cat) =>
      sum + effectiveCategoryBudget(cat, monthlyExpenseTotal, mode),
    0
  );
}

export function allocatedBudgetPercent(
  categories: ExpenseCategoryPreference[],
  monthlyExpenseTotal: number,
  mode: ExpenseBudgetAllocationMode
): number {
  if (monthlyExpenseTotal <= 0) return 0;
  return (allocatedBudgetTotal(categories, monthlyExpenseTotal, mode) /
    monthlyExpenseTotal) *
    100;
}

export function categoryBudgetPercent(
  category: ExpenseCategoryPreference,
  monthlyExpenseTotal: number
): number {
  if (monthlyExpenseTotal <= 0) return category.budgetPercent ?? 0;
  if (category.budgetPercent != null) return category.budgetPercent;
  return (category.monthlyBudget / monthlyExpenseTotal) * 100;
}

export function applyPercentToCategory(
  category: ExpenseCategoryPreference,
  percent: number,
  monthlyExpenseTotal: number
): ExpenseCategoryPreference {
  const budgetPercent = Math.min(100, Math.max(0, percent));
  return {
    ...category,
    budgetPercent,
    monthlyBudget:
      monthlyExpenseTotal > 0
        ? Math.round((monthlyExpenseTotal * budgetPercent) / 100)
        : category.monthlyBudget,
  };
}

export function applyDollarToCategory(
  category: ExpenseCategoryPreference,
  dollars: number,
  monthlyExpenseTotal: number
): ExpenseCategoryPreference {
  const monthlyBudget = Math.max(0, dollars);
  return {
    ...category,
    monthlyBudget,
    budgetPercent:
      monthlyExpenseTotal > 0
        ? Math.round((monthlyBudget / monthlyExpenseTotal) * 1000) / 10
        : category.budgetPercent,
  };
}

export function syncCategoryBudgetsFromPercents(
  categories: ExpenseCategoryPreference[],
  monthlyExpenseTotal: number
): ExpenseCategoryPreference[] {
  if (monthlyExpenseTotal <= 0) return categories;
  return categories.map((cat) => applyPercentToCategory(
    cat,
    cat.budgetPercent ?? categoryBudgetPercent(cat, monthlyExpenseTotal),
    monthlyExpenseTotal
  ));
}

export function resolveMonthlyExpenseTotal(plan: ExpensePlan): number {
  if (plan.monthlyExpenseTotal > 0) return plan.monthlyExpenseTotal;
  return allocatedBudgetTotal(
    plan.categories,
    0,
    "dollar"
  );
}
