import { z } from "zod";
import type { InvestmentCategory } from "../investmentCategory.js";

export const AssetClassSchema = z.enum([
  "index-funds",
  "mutual-funds",
  "bonds",
  "stocks",
  "cash",
]);
export type AssetClass = z.infer<typeof AssetClassSchema>;

export const ASSET_CLASS_ORDER: AssetClass[] = [
  "index-funds",
  "mutual-funds",
  "bonds",
  "stocks",
  "cash",
];

export const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  "index-funds": "Index Funds",
  "mutual-funds": "Mutual Funds",
  bonds: "Bonds",
  stocks: "Stocks",
  cash: "Cash",
};

export function assetClassLabel(assetClass: AssetClass): string {
  return ASSET_CLASS_LABELS[assetClass];
}

const TICKER_ASSET_CLASS: Record<string, AssetClass> = {
  VTI: "index-funds",
  VOO: "index-funds",
  IVV: "index-funds",
  VXUS: "index-funds",
  FXAIX: "mutual-funds",
  VFIAX: "mutual-funds",
  BND: "bonds",
  AGG: "bonds",
  AAPL: "stocks",
  MSFT: "stocks",
  GOOGL: "stocks",
  SCHD: "stocks",
  CASH: "cash",
};

export function mapCategoryToAssetClass(
  category: InvestmentCategory
): AssetClass {
  switch (category) {
    case "etf":
      return "index-funds";
    case "mutual_fund":
      return "mutual-funds";
    case "bond":
      return "bonds";
    case "stock":
      return "stocks";
    case "cash":
      return "cash";
    default:
      return "index-funds";
  }
}

export function tickerFromName(name: string): string {
  return name.split(/[\s—–-]/)[0]?.trim().toUpperCase().slice(0, 8) || "NEW";
}

export function inferAssetClassFromName(name: string): AssetClass {
  const ticker = tickerFromName(name);
  const mapped = TICKER_ASSET_CLASS[ticker];
  if (mapped) return mapped;

  const lower = name.toLowerCase();
  if (/cash|savings|money market|hysa|mmf/.test(lower)) return "cash";
  if (/bond|treasury|fixed income|aggregate/.test(lower)) return "bonds";
  if (/index|total market|s&p|500|etf/.test(lower)) return "index-funds";
  if (/mutual|admiral|institutional/.test(lower)) return "mutual-funds";
  if (/stock|equity|share/.test(lower)) return "stocks";

  return "index-funds";
}
