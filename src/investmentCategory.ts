import { z } from "zod";

export const InvestmentCategorySchema = z.enum([
  "cash",
  "stock",
  "etf",
  "mutual_fund",
  "bond",
  "other",
]);
export type InvestmentCategory = z.infer<typeof InvestmentCategorySchema>;

export const INVESTMENT_CATEGORY_LABELS: Record<InvestmentCategory, string> = {
  cash: "Cash",
  stock: "Stock",
  etf: "ETF",
  mutual_fund: "Mutual Fund",
  bond: "Bond",
  other: "Other",
};

export const INVESTMENT_CATEGORY_ORDER: InvestmentCategory[] = [
  "etf",
  "stock",
  "mutual_fund",
  "bond",
  "cash",
  "other",
];

export function investmentCategoryLabel(
  category: InvestmentCategory
): string {
  return INVESTMENT_CATEGORY_LABELS[category];
}

export function normalizeInvestmentCategory(
  value?: string | null
): InvestmentCategory {
  const normalized = value?.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === "mutualfund") return "mutual_fund";
  const parsed = InvestmentCategorySchema.safeParse(normalized);
  return parsed.success ? parsed.data : "other";
}

export function categorizeInvestment(input: {
  symbol: string;
  description?: string;
}): InvestmentCategory {
  const symbol = input.symbol.trim().toUpperCase();
  if (symbol === "CASH") return "cash";

  const description = (input.description ?? "").trim();
  const haystack = `${description} ${symbol}`.toLowerCase();

  if (
    /\b(etf|exchange[- ]traded fund)\b/i.test(description) ||
    haystack.includes(" etf")
  ) {
    return "etf";
  }

  if (
    /\bmutual fund\b/i.test(description) ||
    (/\bfund\b/i.test(description) &&
      !/\betf\b/i.test(description) &&
      (/\b(index|target date|retirement|income)\b/i.test(description) ||
        /\b(class [a-z0-9]|investor|admiral|institutional|idx)\b/i.test(
          description
        )))
  ) {
    return "mutual_fund";
  }

  if (
    /\b(bond|fixed income|treasury|treas\.|t-bill|t-note|municipal)\b/i.test(
      haystack
    ) &&
    !/\bfund\b/i.test(description)
  ) {
    return "bond";
  }

  if (/\bmoney market\b/i.test(description)) return "cash";

  if (symbol && !symbol.includes(" ")) return "stock";

  return "other";
}
