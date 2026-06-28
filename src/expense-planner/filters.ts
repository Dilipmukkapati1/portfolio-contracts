import type { TransactionCategory } from "../enums.js";

/** Not counted as household spending in Expense Planner. */
export const EXPENSE_IGNORED_CATEGORIES: TransactionCategory[] = [
  "income",
  "transfer",
  "investment",
];

export function isExpenseCategory(category: TransactionCategory): boolean {
  return !EXPENSE_IGNORED_CATEGORIES.includes(category);
}

export function isExpenseDebitTransaction(input: {
  amount: number;
  category: string;
  pending?: boolean;
}): boolean {
  if (input.pending) return false;
  if (input.amount >= 0) return false;
  return isExpenseCategory(input.category as TransactionCategory);
}

export function expenseIgnoredCategorySqlIn(): string {
  return EXPENSE_IGNORED_CATEGORIES.map((c) => `'${c}'`).join(", ");
}
