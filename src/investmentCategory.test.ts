import { describe, expect, it } from "vitest";
import {
  categorizeInvestment,
  investmentCategoryLabel,
  normalizeInvestmentCategory,
} from "./investmentCategory.js";

describe("categorizeInvestment", () => {
  it("classifies cash symbols", () => {
    expect(categorizeInvestment({ symbol: "CASH" })).toBe("cash");
  });

  it("classifies ETFs from description", () => {
    expect(
      categorizeInvestment({
        symbol: "VTI",
        description: "Vanguard Total Stock Market ETF",
      })
    ).toBe("etf");
  });

  it("classifies mutual funds from description", () => {
    expect(
      categorizeInvestment({
        symbol: "VFIAX",
        description: "Vanguard 500 Index Fund Admiral Shares",
      })
    ).toBe("mutual_fund");
  });

  it("classifies bond funds as mutual funds", () => {
    expect(
      categorizeInvestment({
        symbol: "VBTLX",
        description: "Vanguard Total Bond Market Index Fund",
      })
    ).toBe("mutual_fund");
  });

  it("defaults tickers to stock", () => {
    expect(
      categorizeInvestment({
        symbol: "AAPL",
        description: "Apple Inc.",
      })
    ).toBe("stock");
  });
});

describe("normalizeInvestmentCategory", () => {
  it("accepts API-style category values", () => {
    expect(normalizeInvestmentCategory("mutual_fund")).toBe("mutual_fund");
    expect(normalizeInvestmentCategory("Mutual Fund")).toBe("mutual_fund");
  });
});

describe("investmentCategoryLabel", () => {
  it("returns display labels", () => {
    expect(investmentCategoryLabel("etf")).toBe("ETF");
  });
});
