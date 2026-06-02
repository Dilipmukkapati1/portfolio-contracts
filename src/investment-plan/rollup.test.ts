import { describe, expect, it } from "vitest";
import type { PlannedInstrument } from "../dtos/investmentPlan.js";
import {
  buildHouseholdPlanSummary,
  instrumentDollars,
  instrumentPercent,
  sumByClass,
} from "./rollup.js";

const netWorth = 850_000;

describe("instrumentDollars / instrumentPercent", () => {
  it("handles percent units", () => {
    const item: PlannedInstrument = {
      id: "1",
      name: "VTI",
      assetClass: "index-funds",
      unit: "percent",
      value: 22,
      sortOrder: 0,
    };
    expect(instrumentDollars(item, netWorth)).toBeCloseTo(187_000);
    expect(instrumentPercent(item, netWorth)).toBe(22);
  });

  it("handles dollar units", () => {
    const item: PlannedInstrument = {
      id: "2",
      name: "Cash",
      assetClass: "cash",
      unit: "dollar",
      value: 127_500,
      sortOrder: 0,
    };
    expect(instrumentDollars(item, netWorth)).toBe(127_500);
    expect(instrumentPercent(item, netWorth)).toBeCloseTo(15);
  });
});

describe("sumByClass", () => {
  it("aggregates mixed units by asset class", () => {
    const items: PlannedInstrument[] = [
      {
        id: "1",
        name: "VTI",
        assetClass: "index-funds",
        unit: "percent",
        value: 10,
        sortOrder: 0,
      },
      {
        id: "2",
        name: "VXUS",
        assetClass: "index-funds",
        unit: "percent",
        value: 5,
        sortOrder: 1,
      },
      {
        id: "3",
        name: "Cash",
        assetClass: "cash",
        unit: "dollar",
        value: 85_000,
        sortOrder: 2,
      },
    ];
    const byClass = sumByClass(items, netWorth);
    expect(byClass["index-funds"].percent).toBeCloseTo(15);
    expect(byClass["index-funds"].dollars).toBeCloseTo(127_500);
    expect(byClass.cash.dollars).toBe(85_000);
  });
});

describe("buildHouseholdPlanSummary", () => {
  it("flags over-allocation", () => {
    const summary = buildHouseholdPlanSummary({
      netWorth: 100_000,
      instruments: [
        {
          id: "1",
          name: "VTI",
          assetClass: "index-funds",
          unit: "percent",
          value: 110,
          sortOrder: 0,
        },
      ],
      actualTotalDollars: 50_000,
      valuesUnlocked: true,
    });
    expect(summary.overAllocated).toBe(true);
    expect(summary.plannedTotalPercent).toBe(110);
  });
});
