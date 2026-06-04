import { describe, expect, it } from "vitest";
import type { FundProfile } from "../dtos/investmentPlan.js";
import {
  compoundRateForProjection,
  computeInstrumentProjection,
  computePortfolioProjection,
  projectedValue,
} from "./projections.js";

const profile: FundProfile = {
  ticker: "VTI",
  return1y: 0.124,
  return3y: 0.082,
  return5y: 0.095,
  annualizedReturn: 0.098,
  dividendYield: 0.013,
  yearsSinceInception: 18,
  inceptionLabel: "2006",
  expenseRatio: 0.0003,
  feeKind: "expense_ratio",
};

describe("compoundRateForProjection", () => {
  it("returns price return when DRIP off", () => {
    expect(compoundRateForProjection(profile, "1y", false)).toBeCloseTo(0.124);
  });

  it("compounds dividend yield when DRIP on", () => {
    const rate = compoundRateForProjection(profile, "1y", true);
    expect(rate).toBeCloseTo((1 + 0.124) * (1 + 0.013) - 1);
  });
});

describe("projectedValue", () => {
  it("compounds principal over years", () => {
    expect(projectedValue(10_000, 0.1, 10)).toBeCloseTo(25_937.42, 0);
  });
});

describe("computeInstrumentProjection", () => {
  it("returns milestones for each horizon", () => {
    const result = computeInstrumentProjection(profile, 100_000, "5y", true);
    expect(result).not.toBeNull();
    expect(result!.categories[0]).toBe("Today");
    expect(result!.milestones).toHaveLength(4);
    expect(result!.values[0]).toBe(100_000);
  });

  it("returns null for zero principal", () => {
    expect(computeInstrumentProjection(profile, 0, "1y", false)).toBeNull();
  });
});

describe("computePortfolioProjection", () => {
  it("sums multiple legs", () => {
    const bondProfile: FundProfile = {
      ...profile,
      ticker: "BND",
      return5y: 0.008,
      dividendYield: 0.031,
    };
    const result = computePortfolioProjection(
      [
        { principal: 50_000, profile },
        { principal: 50_000, profile: bondProfile },
      ],
      "5y",
      false
    );
    expect(result!.totalPrincipal).toBe(100_000);
    expect(result!.instrumentCount).toBe(2);
    const at10Years = result!.milestones.find((m) => m.years === 10);
    expect(at10Years?.future).toBeGreaterThan(100_000);
  });
});
