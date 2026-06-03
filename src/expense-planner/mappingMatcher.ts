import type { TransactionCategory } from "../enums.js";
import type { ExpenseMappingRule } from "../dtos/expensePlan.js";

export type MatchableTransaction = {
  merchant?: string | null;
  description: string;
  providerCategory?: string | null;
  category: TransactionCategory;
  categorySource?: "auto" | "user" | "provider";
};

export function matchRule(
  txn: MatchableTransaction,
  rule: ExpenseMappingRule
): boolean {
  const merchant = (txn.merchant ?? txn.description).trim();
  const merchantLower = merchant.toLowerCase();
  const patternLower = rule.pattern.toLowerCase();

  switch (rule.matchType) {
    case "merchant_contains":
      return merchantLower.includes(patternLower);
    case "merchant_equals":
      return merchant === rule.pattern;
    case "type_equals":
      return (
        txn.description === rule.pattern ||
        (txn.providerCategory ?? "") === rule.pattern
      );
    default:
      return false;
  }
}

export function resolveCategoryFromRules(
  txn: MatchableTransaction,
  rules: ExpenseMappingRule[]
): TransactionCategory | null {
  if (txn.categorySource === "user") {
    return txn.category !== "uncategorized" ? txn.category : null;
  }
  if (txn.category !== "uncategorized") {
    return txn.category;
  }

  const sorted = [...rules].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const rule of sorted) {
    if (matchRule(txn, rule)) {
      return rule.category;
    }
  }
  return null;
}

export function ruleMatchesTransaction(
  txn: MatchableTransaction,
  rule: ExpenseMappingRule
): boolean {
  if (txn.categorySource === "user") return false;
  return matchRule(txn, rule);
}
