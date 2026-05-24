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

export const MemberRelationshipSchema = z.enum([
  "self",
  "spouse",
  "dependent",
  "other",
]);
export type MemberRelationship = z.infer<typeof MemberRelationshipSchema>;

export const IncomeSourceTypeSchema = z.enum([
  "wages",
  "self_employment",
  "interest",
  "dividends",
  "capital_gains_short",
  "capital_gains_long",
  "other",
]);
export type IncomeSourceType = z.infer<typeof IncomeSourceTypeSchema>;

export const ContributionTypeSchema = z.enum([
  "401k",
  "403b",
  "traditional_ira",
  "roth_ira",
  "sep_ira",
  "solo_401k",
  "simple_ira",
  "hsa",
  "fsa_health",
  "fsa_dependent_care",
  "529",
  "employer_match",
]);
export type ContributionType = z.infer<typeof ContributionTypeSchema>;

export const DataProvenanceSchema = z.enum([
  "manual",
  "derived",
  "integration",
  "member_aggregate",
]);
export type DataProvenance = z.infer<typeof DataProvenanceSchema>;

export const AccountTaxTreatmentSchema = z.enum([
  "taxable_brokerage",
  "traditional_ira",
  "roth_ira",
  "401k",
  "403b",
  "hsa",
  "529",
  "checking",
  "savings",
  "credit",
  "mortgage",
  "loan",
]);
export type AccountTaxTreatment = z.infer<typeof AccountTaxTreatmentSchema>;
