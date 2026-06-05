import { describe, expect, it } from "vitest";
import type { PlannedInstrument } from "../dtos/investmentPlan.js";
import { computeAggregatedPlanFees } from "./fees.js";

const baseInstrument: PlannedInstrument = {
  id: "a",
  name: "VTI",
  ticker: "VTI",
  assetClass: "index-funds",
  unit: "percent",
  value: 50,
  sortOrder: 0,
};

describe("computeAggregatedPlanFees", () => {
  it("returns null when there are no instruments", () => {
    expect(
      computeAggregatedPlanFees({
        instruments: [],
        netWorth: 1_000_000,
        profileForInstrument: () => ({ expenseRatio: 0.0003, feeKind: "expense_ratio" }),
      })
    ).toBeNull();
  });

  it("weights expense ratio by % of net worth", () => {
    const instruments: PlannedInstrument[] = [
      { ...baseInstrument, id: "a", value: 60, name: "VTI" },
      {
        ...baseInstrument,
        id: "b",
        name: "BND",
        value: 40,
        assetClass: "bonds",
      },
    ];

    const result = computeAggregatedPlanFees({
      instruments,
      netWorth: 1_000_000,
      profileForInstrument: (item) =>
        item.id === "a"
          ? { expenseRatio: 0.0003, feeKind: "expense_ratio" }
          : { expenseRatio: 0.0005, feeKind: "expense_ratio" },
    });

    expect(result).not.toBeNull();
    expect(result!.weightedExpenseRatio).toBeCloseTo(0.00038, 6);
    expect(result!.annualExpenseDollars).toBeCloseTo(380, 2);
    expect(result!.feeBearingPercent).toBe(100);
    expect(result!.feeBearingDollars).toBe(1_000_000);
  });

  it("excludes commission and zero-ratio holdings", () => {
    const instruments: PlannedInstrument[] = [
      { ...baseInstrument, id: "a", value: 50 },
      { ...baseInstrument, id: "b", name: "AAPL", value: 50, assetClass: "stocks" },
    ];

    const result = computeAggregatedPlanFees({
      instruments,
      netWorth: 200_000,
      profileForInstrument: (item) =>
        item.id === "a"
          ? { expenseRatio: 0.001, feeKind: "expense_ratio" }
          : { expenseRatio: 0, feeKind: "commission" },
    });

    expect(result).not.toBeNull();
    expect(result!.weightedExpenseRatio).toBeCloseTo(0.001, 6);
    expect(result!.annualExpenseDollars).toBeCloseTo(100, 2);
    expect(result!.instrumentCount).toBe(1);
    expect(result!.feeBearingPercent).toBe(50);
  });
});
