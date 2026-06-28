import { describe, expect, it } from "vitest";
import {
  EXPENSE_IGNORED_CATEGORIES,
  isExpenseCategory,
  isExpenseDebitTransaction,
} from "./filters.js";

describe("expense filters", () => {
  it("ignores income, transfer, and investment categories", () => {
    for (const category of EXPENSE_IGNORED_CATEGORIES) {
      expect(isExpenseCategory(category)).toBe(false);
    }
    expect(isExpenseCategory("food")).toBe(true);
  });

  it("counts only expense debits", () => {
    expect(
      isExpenseDebitTransaction({
        amount: -50,
        category: "food",
      })
    ).toBe(true);
    expect(
      isExpenseDebitTransaction({
        amount: 500,
        category: "income",
      })
    ).toBe(false);
    expect(
      isExpenseDebitTransaction({
        amount: -100,
        category: "transfer",
      })
    ).toBe(false);
  });
});
