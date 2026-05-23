import { z } from "zod";
import {
  FilingStatusSchema,
  PersonaSchema,
} from "../enums.js";

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
});
export type HouseholdSettings = z.infer<typeof HouseholdSettingsSchema>;

export const HouseholdSchema = z.object({
  id: z.string(),
  householdId: z.string(),
  displayName: z.string(),
  state: z.string().length(2),
  filingStatus: FilingStatusSchema,
  dependents: z.number().int().min(0).default(0),
  persona: PersonaSchema,
  netWorthSummary: NetWorthSummarySchema.optional(),
  monthlySpendSummary: MonthlySpendSummarySchema.optional(),
  settings: HouseholdSettingsSchema.optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Household = z.infer<typeof HouseholdSchema>;

export const CreateHouseholdRequestSchema = z.object({
  displayName: z.string().min(1),
  state: z.string().length(2),
  filingStatus: FilingStatusSchema,
  dependents: z.number().int().min(0).default(0),
  persona: PersonaSchema,
});
export type CreateHouseholdRequest = z.infer<typeof CreateHouseholdRequestSchema>;

export const UpdateHouseholdRequestSchema = CreateHouseholdRequestSchema.partial();
export type UpdateHouseholdRequest = z.infer<typeof UpdateHouseholdRequestSchema>;
