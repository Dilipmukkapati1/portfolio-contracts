import { z } from "zod";

export const AnalyzerPeriodSchema = z.enum(["quarterly", "yearly"]);
export type AnalyzerPeriod = z.infer<typeof AnalyzerPeriodSchema>;

export const InstrumentSignalSchema = z.enum([
  "bullish",
  "bearish",
  "neutral",
]);
export type InstrumentSignal = z.infer<typeof InstrumentSignalSchema>;

export const InstrumentIndicatorSchema = z.object({
  id: z.string(),
  label: z.string(),
  value: z.number(),
  unit: z.string().optional(),
  signal: InstrumentSignalSchema,
  changePercent: z.number().optional(),
  note: z.string().optional(),
});
export type InstrumentIndicator = z.infer<typeof InstrumentIndicatorSchema>;

export const InstrumentMovingAverageSchema = z.object({
  label: z.string(),
  value: z.number(),
  priceVsPercent: z.number(),
});
export type InstrumentMovingAverage = z.infer<
  typeof InstrumentMovingAverageSchema
>;

export const InstrumentPriceStructureSchema = z.object({
  currentPrice: z.number(),
  support: z.number(),
  resistance: z.number(),
  fiftyTwoWeekLow: z.number(),
  fiftyTwoWeekHigh: z.number(),
});
export type InstrumentPriceStructure = z.infer<
  typeof InstrumentPriceStructureSchema
>;

export const InstrumentVolumeProfileSchema = z.object({
  avgVolumeLabel: z.string(),
  relativeVolume: z.number(),
  signal: InstrumentSignalSchema,
});
export type InstrumentVolumeProfile = z.infer<
  typeof InstrumentVolumeProfileSchema
>;

export const InstrumentTechnicalSignalSchema = z.object({
  label: z.string(),
  detail: z.string(),
  signal: InstrumentSignalSchema,
  status: z.enum(["active", "watch", "inactive"]),
});
export type InstrumentTechnicalSignal = z.infer<
  typeof InstrumentTechnicalSignalSchema
>;

export const InstrumentAnalysisSchema = z.object({
  symbol: z.string(),
  companyName: z.string(),
  period: AnalyzerPeriodSchema,
  asOf: z.string(),
  currentPrice: z.number(),
  priceChangePercent: z.number(),
  momentumScore: z.number().min(0).max(100),
  trend: InstrumentSignalSchema,
  summary: z.string(),
  indicators: z.array(InstrumentIndicatorSchema),
  movingAverages: z.array(InstrumentMovingAverageSchema),
  priceStructure: InstrumentPriceStructureSchema,
  volumeProfile: InstrumentVolumeProfileSchema,
  technicalSignals: z.array(InstrumentTechnicalSignalSchema),
});
export type InstrumentAnalysis = z.infer<typeof InstrumentAnalysisSchema>;

export const AnalyzerQuoteSchema = z.object({
  symbol: z.string(),
  companyName: z.string(),
  currentPrice: z.number(),
  priceChangePercent: z.number(),
});
export type AnalyzerQuote = z.infer<typeof AnalyzerQuoteSchema>;
