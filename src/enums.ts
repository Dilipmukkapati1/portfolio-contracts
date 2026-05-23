import { z } from "zod";

export const PersonaSchema = z.enum([
  "w2_employee",
  "low_income",
  "business_owner",
  "family_with_kids",
]);
export type Persona = z.infer<typeof PersonaSchema>;

export const FilingStatusSchema = z.enum([
  "single",
  "married_filing_jointly",
  "married_filing_separately",
  "head_of_household",
  "qualifying_surviving_spouse",
]);
export type FilingStatus = z.infer<typeof FilingStatusSchema>;

export const AccountSourceSchema = z.enum([
  "simplefin",
  "snaptrade",
  "manual",
]);
export type AccountSource = z.infer<typeof AccountSourceSchema>;

export const IntegrationProviderSchema = z.enum([
  "simplefin",
  "snaptrade",
]);
export type IntegrationProvider = z.infer<typeof IntegrationProviderSchema>;

export const TransactionCategorySchema = z.enum([
  "income",
  "transfer",
  "housing",
  "utilities",
  "food",
  "transport",
  "healthcare",
  "insurance",
  "entertainment",
  "shopping",
  "education",
  "taxes",
  "fees",
  "investment",
  "other",
  "uncategorized",
]);
export type TransactionCategory = z.infer<typeof TransactionCategorySchema>;

export const SyncStatusSchema = z.enum([
  "idle",
  "syncing",
  "success",
  "error",
]);
export type SyncStatus = z.infer<typeof SyncStatusSchema>;
