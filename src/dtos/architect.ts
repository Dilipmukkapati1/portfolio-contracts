import { z } from "zod";

export const ArchitectAssetClassSchema = z.enum([
  "equity",
  "bond",
  "cash",
  "other",
]);
export type ArchitectAssetClass = z.infer<typeof ArchitectAssetClassSchema>;

export const ArchitectTargetSchema = z.object({
  symbol: z.string().min(1),
  name: z.string().min(1),
  assetClass: ArchitectAssetClassSchema,
  plannedPercent: z.number().min(0).max(100),
});
export type ArchitectTarget = z.infer<typeof ArchitectTargetSchema>;

export const ArchitectStrategyAllocationSchema = z.object({
  equitiesPercent: z.number().min(0).max(100),
  bondsPercent: z.number().min(0).max(100),
  cashPercent: z.number().min(0).max(100),
});
export type ArchitectStrategyAllocation = z.infer<
  typeof ArchitectStrategyAllocationSchema
>;

export const ArchitectExecutionAssetSchema = z.object({
  symbol: z.string(),
  name: z.string(),
  assetClass: ArchitectAssetClassSchema,
  plannedPercent: z.number(),
  actualPercent: z.number(),
  fillStatusPercent: z.number(),
  barColor: z.enum(["purple", "blue", "green", "orange"]),
});
export type ArchitectExecutionAsset = z.infer<
  typeof ArchitectExecutionAssetSchema
>;

export const ArchitectSectorTimeframeSchema = z.enum(["1d", "1w", "1m"]);
export type ArchitectSectorTimeframe = z.infer<
  typeof ArchitectSectorTimeframeSchema
>;

export const ArchitectSectorSliceSchema = z.object({
  id: z.string(),
  label: z.string(),
  shortLabel: z.string().optional(),
  leadSymbol: z.string().optional(),
  weightPercent: z.number().min(0),
  livePerfPercent: z.number().optional(),
  tone: z.enum(["positive", "negative", "neutral"]),
  marketCapLabel: z.string().optional(),
  assetCount: z.number().int().nonnegative().optional(),
  accentColor: z.string().optional(),
});
export type ArchitectSectorSlice = z.infer<typeof ArchitectSectorSliceSchema>;

export const ArchitectDashboardSchema = z.object({
  title: z.string().default("Portfolio Architect"),
  totalCapital: z.number().optional(),
  strategy: ArchitectStrategyAllocationSchema,
  strategyCenterLabel: z.string(),
  executionAssets: z.array(ArchitectExecutionAssetSchema),
  sectors: z.array(ArchitectSectorSliceSchema),
  sharpeRatio: z.number(),
  efficiencyDescription: z.string(),
  catalog: z.array(
    z.object({
      symbol: z.string(),
      name: z.string(),
      assetClass: ArchitectAssetClassSchema,
    })
  ),
});
export type ArchitectDashboard = z.infer<typeof ArchitectDashboardSchema>;

export const UpdateArchitectPlanRequestSchema = z.object({
  totalCapital: z.number().positive().optional(),
  strategy: ArchitectStrategyAllocationSchema.optional(),
  targets: z.array(ArchitectTargetSchema).optional(),
});
export type UpdateArchitectPlanRequest = z.infer<
  typeof UpdateArchitectPlanRequestSchema
>;
