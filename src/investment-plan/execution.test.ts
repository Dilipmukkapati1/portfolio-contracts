import { describe, expect, it } from "vitest";
import type { PlannedInstrument } from "../dtos/investmentPlan.js";
import {
  buildInstrumentExecutionRollups,
  computePlanExecutionOutlook,
  instrumentOutlookValue,
} from "./execution.js";

const netWorth = 850_000;

const plan: PlannedInstrument[] = [
  {
    id: "p1",
    name: "VTI — Total US Market",
    assetClass: "index-funds",
    unit: "percent",
    value: 22,
    sortOrder: 0,
  },
  {
    id: "p2",
    name: "AAPL",
    assetClass: "stocks",
    unit: "percent",
    value: 12,
    sortOrder: 1,
  },
];

describe("instrumentOutlookValue", () => {
  it("caps execution at 100% per instrument", () => {
    expect(instrumentOutlookValue(100_000, 150_000)).toBe(100);
    expect(instrumentOutlookValue(100_000, 50_000)).toBe(50);
  });
});

describe("computePlanExecutionOutlook", () => {
  it("weights overall outlook by planned dollars", () => {
    const rollups = buildInstrumentExecutionRollups({
      instruments: plan,
      netWorth,
      actualHoldings: [
        { symbol: "VTI", marketValue: 187_000 },
        { symbol: "AAPL", marketValue: 50_000 },
      ],
      valuesUnlocked: true,
    });
    const outlook = computePlanExecutionOutlook(rollups);
    expect(outlook).not.toBeNull();
    expect(outlook!.overallOutlook).toBeCloseTo(82, 0);
    expect(outlook!.executedDollars).toBeCloseTo(237_000);
    expect(outlook!.onTrackCount).toBe(1);
  });

  it("returns null when privacy is locked", () => {
    const rollups = buildInstrumentExecutionRollups({
      instruments: plan,
      netWorth,
      actualHoldings: [{ symbol: "VTI", marketValue: 187_000 }],
      valuesUnlocked: false,
    });
    expect(computePlanExecutionOutlook(rollups)).toBeNull();
  });
});
