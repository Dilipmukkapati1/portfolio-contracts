import { z } from "zod";
import { FilingStatusSchema } from "../enums.js";

export const TaxYearInputSchema = z.object({
  taxYear: z.number().int(),
  filingStatus: FilingStatusSchema,
  wages: z.number().default(0),
  selfEmploymentIncome: z.number().default(0),
  interestIncome: z.number().default(0),
  dividendIncome: z.number().default(0),
  capitalGainsShort: z.number().default(0),
  capitalGainsLong: z.number().default(0),
  otherIncome: z.number().default(0),
  adjustments: z.number().default(0),
  itemizedDeductions: z.number().optional(),
  standardDeductionOverride: z.number().optional(),
  dependents: z.number().int().min(0).default(0),
  retirementContributions: z.number().default(0),
  hsaContributions: z.number().default(0),
});
export type TaxYearInput = z.infer<typeof TaxYearInputSchema>;

export const TaxEstimateSchema = z.object({
  taxYear: z.number().int(),
  adjustedGrossIncome: z.number(),
  taxableIncome: z.number(),
  standardDeduction: z.number(),
  federalTax: z.number(),
  effectiveRate: z.number(),
  marginalRate: z.number(),
  breakdown: z.record(z.string(), z.number()).optional(),
});
export type TaxEstimate = z.infer<typeof TaxEstimateSchema>;

export const StrategySchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  estimatedSavings: z.number().optional(),
  eligibility: z.string(),
  risks: z.string().optional(),
  missingData: z.array(z.string()).optional(),
  priority: z.number().int().optional(),
});
export type Strategy = z.infer<typeof StrategySchema>;

export const TaxEstimateRequestSchema = TaxYearInputSchema;
export type TaxEstimateRequest = z.infer<typeof TaxEstimateRequestSchema>;
