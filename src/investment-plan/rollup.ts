import type {
  AllocationClassRollup,
  HouseholdPlanSummary,
  PlannedInstrument,
} from "../dtos/investmentPlan.js";
import {
  ASSET_CLASS_LABELS,
  ASSET_CLASS_ORDER,
  assetClassLabel,
  type AssetClass,
} from "./assetClass.js";

export function instrumentDollars(
  item: Pick<PlannedInstrument, "unit" | "value">,
  netWorth: number
): number {
  return item.unit === "dollar" ? item.value : (item.value / 100) * netWorth;
}

export function instrumentPercent(
  item: Pick<PlannedInstrument, "unit" | "value">,
  netWorth: number
): number {
  if (netWorth <= 0) return 0;
  return item.unit === "percent" ? item.value : (item.value / netWorth) * 100;
}

export function sumByClass(
  items: PlannedInstrument[],
  netWorth: number
): Record<AssetClass, { dollars: number; percent: number }> {
  const out = Object.fromEntries(
    ASSET_CLASS_ORDER.map((c) => [c, { dollars: 0, percent: 0 }])
  ) as Record<AssetClass, { dollars: number; percent: number }>;

  for (const item of items) {
    const d = instrumentDollars(item, netWorth);
    out[item.assetClass].dollars += d;
    out[item.assetClass].percent += instrumentPercent(item, netWorth);
  }
  return out;
}

export function buildAllocationSegments(
  planByClass: Record<AssetClass, { dollars: number; percent: number }>,
  actualByClass: Record<AssetClass, number>,
  actualTotal: number,
  valuesUnlocked: boolean
): AllocationClassRollup[] {
  return ASSET_CLASS_ORDER.map((assetClass) => ({
    assetClass,
    label: assetClassLabel(assetClass),
    planDollars: planByClass[assetClass].dollars,
    planPercent: planByClass[assetClass].percent,
    actualDollars: valuesUnlocked ? actualByClass[assetClass] : null,
    actualPercent:
      actualTotal > 0 ? (actualByClass[assetClass] / actualTotal) * 100 : 0,
  }));
}

export function buildHouseholdPlanSummary(input: {
  netWorth: number;
  instruments: PlannedInstrument[];
  actualTotalDollars: number;
  valuesUnlocked: boolean;
}): Omit<HouseholdPlanSummary, "privacyMode" | "valuesUnlocked"> {
  const { netWorth, instruments, actualTotalDollars } = input;
  const plannedTotalDollars = instruments.reduce(
    (sum, item) => sum + instrumentDollars(item, netWorth),
    0
  );
  const plannedTotalPercent = instruments.reduce(
    (sum, item) => sum + instrumentPercent(item, netWorth),
    0
  );
  const unallocatedDollars = Math.max(0, netWorth - plannedTotalDollars);
  const unallocatedPercent = Math.max(0, 100 - plannedTotalPercent);
  const overAllocated =
    plannedTotalPercent > 100.01 || plannedTotalDollars > netWorth + 1;

  return {
    netWorth,
    plannedTotalDollars,
    plannedTotalPercent,
    actualTotalDollars,
    unallocatedDollars,
    unallocatedPercent,
    instrumentCount: instruments.length,
    overAllocated,
  };
}

export { ASSET_CLASS_LABELS, ASSET_CLASS_ORDER };
