import type {
  InstrumentExecutionRollup,
  PlanExecutionOutlook,
  PlannedInstrument,
} from "../dtos/investmentPlan.js";
import { instrumentDollars, instrumentPercent } from "./rollup.js";
import { tickerFromName } from "./assetClass.js";

export type ActualHoldingSnapshot = {
  symbol: string;
  marketValue: number;
};

const ON_TRACK_THRESHOLD = 90;

function actualByTicker(
  holdings: ActualHoldingSnapshot[]
): Map<string, number> {
  const out = new Map<string, number>();
  for (const h of holdings) {
    const symbol = h.symbol.trim().toUpperCase();
    if (!symbol) continue;
    out.set(symbol, (out.get(symbol) ?? 0) + h.marketValue);
  }
  return out;
}

export function instrumentOutlookValue(
  planDollars: number,
  actualDollars: number
): number {
  if (planDollars <= 0) return 0;
  return Math.min(actualDollars / planDollars, 1) * 100;
}

export function buildInstrumentExecutionRollups(input: {
  instruments: PlannedInstrument[];
  netWorth: number;
  actualHoldings: ActualHoldingSnapshot[];
  valuesUnlocked: boolean;
}): InstrumentExecutionRollup[] {
  const { instruments, netWorth, actualHoldings, valuesUnlocked } = input;
  const actualMap = actualByTicker(actualHoldings);

  return instruments.map((item) => {
    const ticker = tickerFromName(item.name).toUpperCase();
    const planDollars = instrumentDollars(item, netWorth);
    const planPercent = instrumentPercent(item, netWorth);
    const actualDollars = valuesUnlocked ? (actualMap.get(ticker) ?? 0) : null;
    const outlookValue =
      valuesUnlocked && actualDollars != null
        ? instrumentOutlookValue(planDollars, actualDollars)
        : null;

    return {
      instrumentId: item.id,
      ticker,
      planDollars,
      planPercent,
      actualDollars,
      outlookValue,
    };
  });
}

export function computePlanExecutionOutlook(
  rollups: InstrumentExecutionRollup[]
): PlanExecutionOutlook | null {
  const planned = rollups.filter((r) => r.planDollars > 0);
  if (planned.length === 0) return null;

  const withOutlook = planned.filter((r) => r.outlookValue != null);
  if (withOutlook.length === 0) return null;

  const plannedTotalDollars = planned.reduce((s, r) => s + r.planDollars, 0);
  if (plannedTotalDollars <= 0) return null;

  let executedDollars = 0;
  let weightedOutlook = 0;
  let onTrackCount = 0;

  for (const row of withOutlook) {
    const actual = row.actualDollars ?? 0;
    const deployed = Math.min(actual, row.planDollars);
    executedDollars += deployed;
    weightedOutlook += (row.outlookValue! / 100) * row.planDollars;
    if (row.outlookValue! >= ON_TRACK_THRESHOLD) onTrackCount += 1;
  }

  return {
    overallOutlook: (weightedOutlook / plannedTotalDollars) * 100,
    instrumentCount: withOutlook.length,
    onTrackCount,
    plannedTotalDollars,
    executedDollars,
  };
}
