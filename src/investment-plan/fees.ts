import type { FundProfile, PlannedInstrument } from "../dtos/investmentPlan.js";
import { instrumentDollars, instrumentPercent } from "./rollup.js";

export type AggregatedPlanFees = {
  /** Weighted average expense ratio across fee-bearing planned holdings (0–1). */
  weightedExpenseRatio: number;
  /** Sum of annual expense dollars (principal × expense ratio per holding). */
  annualExpenseDollars: number;
  /** Planned principal included in the fee rollup (expense-ratio funds only). */
  feeBearingDollars: number;
  /** Planned % of net worth included in the fee rollup. */
  feeBearingPercent: number;
  instrumentCount: number;
};

/**
 * Portfolio-level expense ratio and annual cost from planned allocations.
 * Weighting uses each holding's % of net worth (or dollar allocation).
 * Holdings without an expense ratio (commission / none) are excluded.
 */
export function computeAggregatedPlanFees(input: {
  instruments: PlannedInstrument[];
  netWorth: number;
  profileForInstrument: (item: PlannedInstrument) => Pick<
    FundProfile,
    "expenseRatio" | "feeKind"
  >;
}): AggregatedPlanFees | null {
  const { instruments, netWorth, profileForInstrument } = input;
  if (instruments.length === 0 || netWorth <= 0) return null;

  let feeBearingDollars = 0;
  let feeBearingPercent = 0;
  let weightedRatioNumerator = 0;
  let annualExpenseDollars = 0;
  let instrumentCount = 0;

  for (const item of instruments) {
    const profile = profileForInstrument(item);
    if (profile.feeKind !== "expense_ratio" || profile.expenseRatio <= 0) {
      continue;
    }

    const dollars = instrumentDollars(item, netWorth);
    const percent = instrumentPercent(item, netWorth);
    if (dollars <= 0 && percent <= 0) continue;

    instrumentCount += 1;
    feeBearingDollars += dollars;
    feeBearingPercent += percent;
    weightedRatioNumerator += percent * profile.expenseRatio;
    annualExpenseDollars += dollars * profile.expenseRatio;
  }

  if (instrumentCount === 0 || feeBearingPercent <= 0) return null;

  return {
    weightedExpenseRatio: weightedRatioNumerator / feeBearingPercent,
    annualExpenseDollars,
    feeBearingDollars,
    feeBearingPercent,
    instrumentCount,
  };
}
