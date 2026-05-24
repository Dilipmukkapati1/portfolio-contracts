import { z } from "zod";
import { FilingStatusSchema, PersonaSchema } from "../enums.js";

export const NetWorthSummarySchema = z.object({
  totalAssets: z.number(),
  totalLiabilities: z.number(),
  netWorth: z.number(),
  cashBalance: z.number().optional(),
  investmentValue: z.number().optional(),
  updatedAt: z.string().datetime().optional(),
});
export type NetWorthSummary = z.infer<typeof NetWorthSummarySchema>;

export const MonthlySpendSummarySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  totalSpend: z.number(),
  byCategory: z.record(z.string(), z.number()).optional(),
  updatedAt: z.string().datetime().optional(),
});
export type MonthlySpendSummary = z.infer<typeof MonthlySpendSummarySchema>;

export const HouseholdSettingsSchema = z.object({
  currency: z.string().default("USD"),
  timezone: z.string().default("America/New_York"),
  defaultTaxYear: z.number().int().optional(),
});
export type HouseholdSettings = z.infer<typeof HouseholdSettingsSchema>;

export const HouseholdSchema = z.object({
  id: z.string(),
  householdId: z.string(),
  displayName: z.string(),
  primaryState: z.string().length(2).optional(),
  state: z.string().length(2),
  filingStatus: FilingStatusSchema.optional(),
  dependents: z.number().int().min(0).optional(),
  persona: PersonaSchema,
  netWorthSummary: NetWorthSummarySchema.optional(),
  monthlySpendSummary: MonthlySpendSummarySchema.optional(),
  settings: HouseholdSettingsSchema.optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Household = z.infer<typeof HouseholdSchema>;

/** Normalize legacy `state`-only documents to include `primaryState`. */
export function normalizeHousehold(household: Household): Household {
  const primaryState = household.primaryState ?? household.state;
  return {
    ...household,
    primaryState,
    state: household.state ?? primaryState,
  };
}

export const CreateHouseholdRequestSchema = z.object({
  displayName: z.string().min(1),
  primaryState: z.string().length(2).optional(),
  state: z.string().length(2).optional(),
  persona: PersonaSchema,
  settings: HouseholdSettingsSchema.optional(),
});
export type CreateHouseholdRequest = z.infer<typeof CreateHouseholdRequestSchema>;

export function resolvePrimaryState(data: {
  primaryState?: string;
  state?: string;
}): string {
  const raw = data.primaryState ?? data.state;
  if (!raw || raw.length !== 2) {
    throw new Error("primaryState or state (2-letter) is required");
  }
  return raw.toUpperCase();
}

export const UpdateHouseholdRequestSchema = CreateHouseholdRequestSchema.partial();
export type UpdateHouseholdRequest = z.infer<typeof UpdateHouseholdRequestSchema>;

const HouseholdIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]+$/, "Use letters, numbers, hyphens, or underscores");

export const CreateHouseholdWithIdSchema = CreateHouseholdRequestSchema.extend({
  householdId: HouseholdIdSchema,
});
export type CreateHouseholdWithId = z.infer<typeof CreateHouseholdWithIdSchema>;

export const DeleteHouseholdsRequestSchema = z.object({
  householdIds: z.array(HouseholdIdSchema).min(1),
});
export type DeleteHouseholdsRequest = z.infer<typeof DeleteHouseholdsRequestSchema>;

export const HouseholdListResponseSchema = z.object({
  households: z.array(HouseholdSchema),
});
export type HouseholdListResponse = z.infer<typeof HouseholdListResponseSchema>;

export const DeleteHouseholdsResponseSchema = z.object({
  deleted: z.array(z.string()),
  failed: z.array(
    z.object({
      householdId: z.string(),
      reason: z.string(),
    })
  ),
});
export type DeleteHouseholdsResponse = z.infer<typeof DeleteHouseholdsResponseSchema>;
