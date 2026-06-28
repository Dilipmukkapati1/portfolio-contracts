import type { TransactionCategory } from "../enums.js";
import { TransactionCategorySchema } from "../enums.js";
import type { ExpenseCategoryPreference, ExpensePlan } from "../dtos/expensePlan.js";
import { expensePlanDocumentId } from "../dtos/expensePlan.js";
import { STANDARD_PLAN_CATEGORIES } from "./budget.js";
import { isExpenseCategory } from "./filters.js";

const HIDDEN_BY_DEFAULT = new Set<TransactionCategory>([
  "income",
  "transfer",
  "investment",
  "taxes",
  "fees",
  "uncategorized",
]);

export const DEFAULT_CATEGORY_LABELS: Record<TransactionCategory, string> = {
  income: "Income",
  transfer: "Transfer",
  housing: "Housing",
  utilities: "Bills & utilities",
  food: "Food & dining",
  transport: "Transport",
  healthcare: "Health",
  insurance: "Insurance",
  entertainment: "Entertainment",
  shopping: "Shopping",
  education: "Education",
  taxes: "Taxes",
  fees: "Fees",
  investment: "Investment",
  other: "Other",
  uncategorized: "Uncategorized",
};

export function defaultCategoryPreferences(): ExpenseCategoryPreference[] {
  return TransactionCategorySchema.options.map((category) => ({
    category,
    label: DEFAULT_CATEGORY_LABELS[category],
    hidden: HIDDEN_BY_DEFAULT.has(category),
    monthlyBudget: 0,
  }));
}

export function buildDefaultExpensePlan(householdId: string): ExpensePlan {
  const now = new Date().toISOString();
  return normalizeExpensePlan({
    id: expensePlanDocumentId(householdId),
    householdId,
    monthlyExpenseTotal: 0,
    budgetAllocationMode: "dollar",
    categories: defaultCategoryPreferences(),
    mappingRules: [],
    updatedAt: now,
  });
}

/** Merge saved prefs with defaults and restore standard plan categories when missing. */
export function normalizeExpensePlan(plan: ExpensePlan): ExpensePlan {
  const defaults = defaultCategoryPreferences();
  const saved = new Map(plan.categories.map((c) => [c.category, c]));
  const merged = defaults.map((def) => {
    const existing = saved.get(def.category);
    if (!existing) return def;
    return {
      ...def,
      ...existing,
      category: def.category,
    };
  });

  for (const [category, pref] of saved) {
    if (!merged.some((c) => c.category === category)) {
      merged.push(pref);
    }
  }

  const visibleExpense = merged.filter(
    (c) => !c.hidden && isExpenseCategory(c.category)
  );
  const standardVisible = visibleExpense.filter((c) =>
    STANDARD_PLAN_CATEGORIES.includes(c.category)
  );

  let categories = merged;
  if (standardVisible.length < 5) {
    categories = merged.map((c) =>
      STANDARD_PLAN_CATEGORIES.includes(c.category)
        ? { ...c, hidden: false }
        : c
    );
  }

  return {
    ...plan,
    monthlyExpenseTotal: plan.monthlyExpenseTotal ?? 0,
    budgetAllocationMode: plan.budgetAllocationMode ?? "dollar",
    categories,
  };
}

export function visibleCategories(
  categories: ExpenseCategoryPreference[]
): ExpenseCategoryPreference[] {
  return categories.filter((c) => !c.hidden && isExpenseCategory(c.category));
}

export function categoryDisplayLabel(
  category: TransactionCategory,
  preferences: ExpenseCategoryPreference[]
): string {
  const pref = preferences.find((c) => c.category === category);
  return pref?.label ?? DEFAULT_CATEGORY_LABELS[category];
}
