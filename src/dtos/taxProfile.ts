import { z } from "zod";
import {
  ContributionTypeSchema,
  DataProvenanceSchema,
  FilingStatusSchema,
} from "../enums.js";
import { TaxEstimateSchema, TaxYearInputSchema } from "./tax.js";

export const ContributionLimitStatusSchema = z.object({
  type: ContributionTypeSchema,
  memberId: z.string().optional(),
  limit: z.number(),
  contributed: z.number(),
  remaining: z.number(),
});
export type ContributionLimitStatus = z.infer<typeof ContributionLimitStatusSchema>;

export const TaxProfileSchema = z.object({
  id: z.string().min(1),
  householdId: z.string().min(1),
  taxYear: z.number().int(),
  filingStatus: FilingStatusSchema,
  dependentCount: z.number().int().min(0).default(0),
  memberIds: z.array(z.string()).default([]),
  inputs: TaxYearInputSchema,
  fieldProvenance: z
    .record(z.string(), DataProvenanceSchema)
    .optional(),
  withholding: z
    .object({
      federalYtd: z.number().optional(),
      stateYtd: z.number().optional(),
    })
    .optional(),
  estimatedPayments: z
    .object({
      federalYtd: z.number().optional(),
    })
    .optional(),
  contributionLimits: z.array(ContributionLimitStatusSchema).optional(),
  lastEstimate: TaxEstimateSchema.optional(),
  lastEstimatedAt: z.string().datetime().optional(),
  strategyChecklist: z.array(z.string()).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type TaxProfile = z.infer<typeof TaxProfileSchema>;

export const UpsertTaxProfileRequestSchema = z.object({
  filingStatus: FilingStatusSchema.optional(),
  inputs: TaxYearInputSchema.partial().optional(),
  withholding: TaxProfileSchema.shape.withholding.optional(),
  estimatedPayments: TaxProfileSchema.shape.estimatedPayments.optional(),
});
export type UpsertTaxProfileRequest = z.infer<typeof UpsertTaxProfileRequestSchema>;

export function taxProfileDocumentId(householdId: string, taxYear: number): string {
  return `${householdId}:${taxYear}`;
}
