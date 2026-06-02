import { describe, expect, it } from "vitest";
import {
  inferAssetClassFromName,
  mapCategoryToAssetClass,
  tickerFromName,
} from "./assetClass.js";

describe("mapCategoryToAssetClass", () => {
  it("maps investment categories to plan asset classes", () => {
    expect(mapCategoryToAssetClass("etf")).toBe("index-funds");
    expect(mapCategoryToAssetClass("mutual_fund")).toBe("mutual-funds");
    expect(mapCategoryToAssetClass("bond")).toBe("bonds");
    expect(mapCategoryToAssetClass("stock")).toBe("stocks");
    expect(mapCategoryToAssetClass("cash")).toBe("cash");
    expect(mapCategoryToAssetClass("other")).toBe("index-funds");
  });
});

describe("tickerFromName", () => {
  it("extracts ticker prefix from display names", () => {
    expect(tickerFromName("VTI — Total US Market")).toBe("VTI");
    expect(tickerFromName("High-yield savings")).toBe("HIGH");
  });
});

describe("inferAssetClassFromName", () => {
  it("uses known tickers", () => {
    expect(inferAssetClassFromName("VTI — Total US Market")).toBe("index-funds");
    expect(inferAssetClassFromName("BND — Aggregate Bond")).toBe("bonds");
    expect(inferAssetClassFromName("AAPL")).toBe("stocks");
  });

  it("infers from keywords", () => {
    expect(inferAssetClassFromName("High-yield savings")).toBe("cash");
    expect(inferAssetClassFromName("Treasury bond fund")).toBe("bonds");
    expect(inferAssetClassFromName("Unknown XYZ")).toBe("index-funds");
  });
});
