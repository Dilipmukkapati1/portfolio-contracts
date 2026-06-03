import { describe, expect, it } from "vitest";
import type { ExpenseMappingRule } from "../dtos/expensePlan.js";
import {
  matchRule,
  resolveCategoryFromRules,
  ruleMatchesTransaction,
} from "./mappingMatcher.js";

const foodRule: ExpenseMappingRule = {
  id: "r1",
  matchType: "merchant_contains",
  pattern: "whole foods",
  category: "food",
  applyToPast: true,
  sortOrder: 0,
};

describe("matchRule", () => {
  it("matches merchant_contains case-insensitively", () => {
    expect(
      matchRule(
        { description: "Purchase", merchant: "Whole Foods Market", category: "uncategorized" },
        foodRule
      )
    ).toBe(true);
  });

  it("matches merchant_equals exactly", () => {
    const rule: ExpenseMappingRule = {
      ...foodRule,
      matchType: "merchant_equals",
      pattern: "Netflix",
    };
    expect(
      matchRule(
        { description: "Sub", merchant: "Netflix", category: "uncategorized" },
        rule
      )
    ).toBe(true);
    expect(
      matchRule(
        { description: "Sub", merchant: "netflix", category: "uncategorized" },
        rule
      )
    ).toBe(false);
  });

  it("matches type_equals on description or providerCategory", () => {
    const rule: ExpenseMappingRule = {
      ...foodRule,
      matchType: "type_equals",
      pattern: "ACH Debit",
    };
    expect(
      matchRule(
        { description: "ACH Debit", category: "uncategorized" },
        rule
      )
    ).toBe(true);
    expect(
      matchRule(
        {
          description: "Payment",
          providerCategory: "ACH Debit",
          category: "uncategorized",
        },
        rule
      )
    ).toBe(true);
  });
});

describe("resolveCategoryFromRules", () => {
  it("returns existing non-uncategorized category", () => {
    expect(
      resolveCategoryFromRules(
        { description: "X", category: "transport", categorySource: "auto" },
        [foodRule]
      )
    ).toBe("transport");
  });

  it("respects user override", () => {
    expect(
      resolveCategoryFromRules(
        { description: "Whole Foods", category: "shopping", categorySource: "user" },
        [foodRule]
      )
    ).toBe("shopping");
  });

  it("applies first matching rule for uncategorized", () => {
    expect(
      resolveCategoryFromRules(
        { description: "Whole Foods", merchant: "Whole Foods", category: "uncategorized" },
        [foodRule]
      )
    ).toBe("food");
  });
});

describe("ruleMatchesTransaction", () => {
  it("skips user-overridden transactions", () => {
    expect(
      ruleMatchesTransaction(
        { description: "Whole Foods", category: "uncategorized", categorySource: "user" },
        foodRule
      )
    ).toBe(false);
  });
});
