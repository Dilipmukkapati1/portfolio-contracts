import { z } from "zod";
import { TransactionCategorySchema } from "../enums.js";

export const ExpenseMappingMatchTypeSchema = z.enum([
  "merchant_contains",
  "merchant_equals",
  "type_equals",
]);
export type ExpenseMappingMatchType = z.infer<
  typeof ExpenseMappingMatchTypeSchema
>;

export const ExpenseBudgetAllocationModeSchema = z.enum(["dollar", "percent"]);
export type ExpenseBudgetAllocationMode = z.infer<
  typeof ExpenseBudgetAllocationModeSchema
>;

export const ExpenseCategoryPreferenceSchema = z.object({
  category: TransactionCategorySchema,
  label: z.string().min(1).optional(),
  hidden: z.boolean().default(false),
  monthlyBudget: z.number().min(0).default(0),
  /** Share of {@link ExpensePlan.monthlyExpenseTotal} when allocation mode is percent. */
  budgetPercent: z.number().min(0).max(100).optional(),
});
export type ExpenseCategoryPreference = z.infer<
  typeof ExpenseCategoryPreferenceSchema
>;

export const ExpenseMappingRuleSchema = z.object({
  id: z.string().min(1),
  matchType: ExpenseMappingMatchTypeSchema,
  pattern: z.string().min(1),
  category: TransactionCategorySchema,
  applyToPast: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
});
export type ExpenseMappingRule = z.infer<typeof ExpenseMappingRuleSchema>;

export const ExpensePlanSchema = z.object({
  id: z.string().min(1),
  householdId: z.string().min(1),
  /** Target monthly outflow the user splits across categories. */
  monthlyExpenseTotal: z.number().min(0).default(0),
  budgetAllocationMode: ExpenseBudgetAllocationModeSchema.default("dollar"),
  categories: z.array(ExpenseCategoryPreferenceSchema).default([]),
  mappingRules: z.array(ExpenseMappingRuleSchema).default([]),
  updatedAt: z.string().datetime(),
});
export type ExpensePlan = z.infer<typeof ExpensePlanSchema>;

export const UpsertExpensePlanRequestSchema = z.object({
  monthlyExpenseTotal: z.number().min(0).optional(),
  budgetAllocationMode: ExpenseBudgetAllocationModeSchema.optional(),
  categories: z.array(ExpenseCategoryPreferenceSchema).optional(),
  mappingRules: z.array(ExpenseMappingRuleSchema).optional(),
});
export type UpsertExpensePlanRequest = z.infer<
  typeof UpsertExpensePlanRequestSchema
>;

export const ApplyMappingRulesRequestSchema = z.object({
  ruleIds: z.array(z.string().min(1)).optional(),
});
export type ApplyMappingRulesRequest = z.infer<
  typeof ApplyMappingRulesRequestSchema
>;

export const ApplyMappingRulesResponseSchema = z.object({
  updatedCount: z.number().int().nonnegative(),
});
export type ApplyMappingRulesResponse = z.infer<
  typeof ApplyMappingRulesResponseSchema
>;

export function expensePlanDocumentId(householdId: string): string {
  return `expense-plan-${householdId}`;
}
