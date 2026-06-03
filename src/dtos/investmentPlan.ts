import { z } from "zod";
import { AssetClassSchema } from "../investment-plan/assetClass.js";

export const DisplayUnitSchema = z.enum(["dollar", "percent"]);
export type DisplayUnit = z.infer<typeof DisplayUnitSchema>;

export const ReturnPeriodSchema = z.enum(["1y", "3y", "5y", "life"]);
export type ReturnPeriod = z.infer<typeof ReturnPeriodSchema>;

export const FeeKindSchema = z.enum(["expense_ratio", "commission", "none"]);
export type FeeKind = z.infer<typeof FeeKindSchema>;

/** Security type from market data providers (search / profile). */
export const InstrumentAssetTypeSchema = z.enum([
  "stock",
  "etf",
  "mutual_fund",
  "bond",
  "fund",
  "other",
]);
export type InstrumentAssetType = z.infer<typeof InstrumentAssetTypeSchema>;

export const MarketDataSourceSchema = z.enum(["fmp", "stub", "estimated"]);
export type MarketDataSource = z.infer<typeof MarketDataSourceSchema>;

export const PlannedInstrumentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  ticker: z.string().min(1).optional(),
  assetClass: AssetClassSchema,
  unit: DisplayUnitSchema,
  value: z.number().min(0),
  sortOrder: z.number().int().min(0).default(0),
});
export type PlannedInstrument = z.infer<typeof PlannedInstrumentSchema>;

export const InvestmentPlanSchema = z.object({
  id: z.string().min(1),
  householdId: z.string().min(1),
  instruments: z.array(PlannedInstrumentSchema).default([]),
  updatedAt: z.string().datetime(),
});
export type InvestmentPlan = z.infer<typeof InvestmentPlanSchema>;

export const UpsertInvestmentPlanRequestSchema = z.object({
  instruments: z.array(
    PlannedInstrumentSchema.omit({ ticker: true }).extend({
      sortOrder: z.number().int().min(0).optional(),
    })
  ),
});
export type UpsertInvestmentPlanRequest = z.infer<
  typeof UpsertInvestmentPlanRequestSchema
>;

export const HouseholdPlanSummarySchema = z.object({
  netWorth: z.number(),
  plannedTotalDollars: z.number(),
  plannedTotalPercent: z.number(),
  actualTotalDollars: z.number(),
  unallocatedDollars: z.number(),
  unallocatedPercent: z.number(),
  instrumentCount: z.number().int().min(0),
  overAllocated: z.boolean(),
  privacyMode: z.enum(["locked", "unlocked"]),
  valuesUnlocked: z.boolean(),
});
export type HouseholdPlanSummary = z.infer<typeof HouseholdPlanSummarySchema>;

export const AllocationClassRollupSchema = z.object({
  assetClass: AssetClassSchema,
  label: z.string(),
  planDollars: z.number(),
  planPercent: z.number(),
  actualDollars: z.number().nullable(),
  actualPercent: z.number(),
});
export type AllocationClassRollup = z.infer<typeof AllocationClassRollupSchema>;

export const FundProfileSchema = z.object({
  ticker: z.string(),
  return1y: z.number(),
  return3y: z.number(),
  return5y: z.number(),
  annualizedReturn: z.number(),
  dividendYield: z.number(),
  yearsSinceInception: z.number(),
  inceptionLabel: z.string(),
  expenseRatio: z.number(),
  feeKind: FeeKindSchema,
  /** Display name from market data (when available). */
  name: z.string().optional(),
  /** Latest trade price in quote currency. */
  price: z.number().optional(),
  /** 1-day price change as a decimal (e.g. 0.012 = +1.2%). */
  priceChange1d: z.number().optional(),
  marketCap: z.number().optional(),
  volume: z.number().optional(),
  exchange: z.string().optional(),
  currency: z.string().optional(),
  assetType: InstrumentAssetTypeSchema.optional(),
  dataSource: MarketDataSourceSchema.optional(),
  /** ISO timestamp when quote/profile fields were fetched. */
  asOf: z.string().datetime().optional(),
});
export type FundProfile = z.infer<typeof FundProfileSchema>;

export const ProjectionMilestoneSchema = z.object({
  years: z.number().int(),
  future: z.number(),
  gain: z.number(),
  multiple: z.number(),
});
export type ProjectionMilestone = z.infer<typeof ProjectionMilestoneSchema>;

export const ProjectionResponseSchema = z.object({
  categories: z.array(z.string()),
  values: z.array(z.number()),
  milestones: z.array(ProjectionMilestoneSchema),
  totalPrincipal: z.number().optional(),
  instrumentCount: z.number().int().optional(),
});
export type ProjectionResponse = z.infer<typeof ProjectionResponseSchema>;

export const InstrumentSearchResultSchema = z.object({
  ticker: z.string(),
  name: z.string(),
  exchange: z.string().optional(),
  assetType: InstrumentAssetTypeSchema.optional(),
});
export type InstrumentSearchResult = z.infer<typeof InstrumentSearchResultSchema>;

export function investmentPlanDocumentId(householdId: string): string {
  return `plan-${householdId}`;
}

export const InstrumentProjectionRequestSchema = z.object({
  ticker: z.string().min(1),
  principal: z.number().min(0),
  period: ReturnPeriodSchema,
  reinvestDividends: z.boolean().default(false),
});
export type InstrumentProjectionRequest = z.infer<
  typeof InstrumentProjectionRequestSchema
>;

export const PortfolioProjectionInstrumentSchema = z.object({
  name: z.string().min(1),
  assetClass: AssetClassSchema,
  unit: DisplayUnitSchema,
  value: z.number().min(0),
});

export const PortfolioProjectionRequestSchema = z.object({
  netWorth: z.number().min(0),
  instruments: z.array(PortfolioProjectionInstrumentSchema),
  period: ReturnPeriodSchema,
  reinvestDividends: z.boolean().default(false),
});
export type PortfolioProjectionRequest = z.infer<
  typeof PortfolioProjectionRequestSchema
>;
