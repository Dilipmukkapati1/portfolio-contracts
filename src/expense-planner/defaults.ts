import type { TransactionCategory } from "../enums.js";
import { TransactionCategorySchema } from "../enums.js";
import type { ExpenseCategoryPreference, ExpensePlan } from "../dtos/expensePlan.js";
import { expensePlanDocumentId } from "../dtos/expensePlan.js";

const HIDDEN_BY_DEFAULT = new Set<TransactionCategory>([
  "income",
  "transfer",
  "investment",
  "taxes",
  "fees",
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
  return {
    id: expensePlanDocumentId(householdId),
    householdId,
    categories: defaultCategoryPreferences(),
    mappingRules: [],
    updatedAt: now,
  };
}

export function visibleCategories(
  categories: ExpenseCategoryPreference[]
): ExpenseCategoryPreference[] {
  return categories.filter((c) => !c.hidden);
}

export function categoryDisplayLabel(
  category: TransactionCategory,
  preferences: ExpenseCategoryPreference[]
): string {
  const pref = preferences.find((c) => c.category === category);
  return pref?.label ?? DEFAULT_CATEGORY_LABELS[category];
}
