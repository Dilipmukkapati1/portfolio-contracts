import type { FundProfile, PlannedInstrument } from "../dtos/investmentPlan.js";
import { instrumentDollars, instrumentPercent } from "./rollup.js";

export type AggregatedPlanFees = {
  /** Portfolio expense ratio: total annual fees ÷ total net worth (0–1). */
  weightedExpenseRatio: number;
  /** Sum of annual expense dollars (allocation × expense ratio per fund). */
  annualExpenseDollars: number;
  /** Planned principal included in the fee rollup (expense-ratio funds only). */
  feeBearingDollars: number;
  /** Planned % of net worth included in the fee rollup. */
  feeBearingPercent: number;
  instrumentCount: number;
};

/**
 * Portfolio-level expense ratio and annual cost from planned allocations.
 * Per fund: annual expense = planned allocation ($) × expense ratio.
 * Portfolio expense ratio = sum(annual expenses) ÷ total net worth.
 * Holdings without an expense ratio (commission / none) contribute $0.
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
    annualExpenseDollars += dollars * profile.expenseRatio;
  }

  if (instrumentCount === 0) return null;

  return {
    weightedExpenseRatio: annualExpenseDollars / netWorth,
    annualExpenseDollars,
    feeBearingDollars,
    feeBearingPercent,
    instrumentCount,
  };
}
