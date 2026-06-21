import { z } from "zod";
import { AccountSchema } from "./account.js";
import { HoldingSchema } from "./holding.js";
import { HouseholdSchema } from "./household.js";
import { MemberSchema } from "./member.js";
import { TaxProfileSchema } from "./taxProfile.js";
import { StrategySchema, TaxEstimateSchema } from "./tax.js";
import { TransactionSchema } from "./transaction.js";
import { ContributionTypeSchema } from "../enums.js";

export const PrivacyModeSchema = z.enum(["locked", "unlocked"]);
export type PrivacyMode = z.infer<typeof PrivacyModeSchema>;

export const PrivacyUnlockRequestSchema = z.object({
  password: z.string().min(1),
});
export type PrivacyUnlockRequest = z.infer<typeof PrivacyUnlockRequestSchema>;

export const PrivacyUnlockResponseSchema = z.object({
  privacyToken: z.string().min(1),
  expiresAt: z.string().datetime(),
});
export type PrivacyUnlockResponse = z.infer<typeof PrivacyUnlockResponseSchema>;

export const PercentAllocationSliceSchema = z.object({
  id: z.string(),
  label: z.string(),
  percent: z.number(),
});
export type PercentAllocationSlice = z.infer<typeof PercentAllocationSliceSchema>;

export const RedactedHoldingSchema = HoldingSchema.omit({
  householdId: true,
  quantity: true,
  price: true,
  marketValue: true,
  costBasis: true,
  currency: true,
}).extend({
  portfolioPercent: z.number().optional(),
  categoryPercent: z.number().optional(),
  accountPercent: z.number().optional(),
});
export type RedactedHolding = z.infer<typeof RedactedHoldingSchema>;

export const RedactedAccountSchema = AccountSchema.omit({
  householdId: true,
  balance: true,
  currency: true,
}).extend({
  percentOfNetWorth: z.number().optional(),
  sectionPercent: z.number().optional(),
});
export type RedactedAccount = z.infer<typeof RedactedAccountSchema>;

export const RedactedTransactionSchema = TransactionSchema.omit({
  householdId: true,
  amount: true,
  currency: true,
}).extend({
  direction: z.enum(["credit", "debit"]).optional(),
});
export type RedactedTransaction = z.infer<typeof RedactedTransactionSchema>;

export const RedactedTransactionSummaryResponseSchema = z.object({
  privacyMode: z.literal("locked"),
  valuesUnlocked: z.literal(false),
  spendByCategoryPercent: z.record(z.string(), z.number()),
  transactionCount: z.number().int().nonnegative(),
});
export type RedactedTransactionSummaryResponse = z.infer<
  typeof RedactedTransactionSummaryResponseSchema
>;

export const UnlockedTransactionSummaryResponseSchema = z.object({
  privacyMode: z.literal("unlocked"),
  valuesUnlocked: z.literal(true),
  totalCredits: z.number(),
  totalSpend: z.number(),
  spendByCategory: z.record(z.string(), z.number()),
  spendByCategoryPercent: z.record(z.string(), z.number()).optional(),
  transactionCount: z.number().int().nonnegative(),
});
export type UnlockedTransactionSummaryResponse = z.infer<
  typeof UnlockedTransactionSummaryResponseSchema
>;

export const TransactionSummaryViewResponseSchema = z.discriminatedUnion(
  "privacyMode",
  [
    RedactedTransactionSummaryResponseSchema,
    UnlockedTransactionSummaryResponseSchema,
  ]
);
export type TransactionSummaryViewResponse = z.infer<
  typeof TransactionSummaryViewResponseSchema
>;

export const RedactedMemberSchema = MemberSchema.omit({
  householdId: true,
  incomeSources: true,
  contributions: true,
}).extend({
  percentOfHouseholdIncome: z.number().optional(),
});
export type RedactedMember = z.infer<typeof RedactedMemberSchema>;

export const RedactedTaxMixPercentSchema = z.object({
  federal: z.number(),
  socialSecurity: z.number(),
  medicare: z.number(),
  niit: z.number(),
});
export type RedactedTaxMixPercent = z.infer<typeof RedactedTaxMixPercentSchema>;

export const RedactedTaxEstimateSchema = TaxEstimateSchema.pick({
  taxYear: true,
  effectiveRate: true,
  marginalRate: true,
}).extend({
  totalTaxRate: z.number().optional(),
  taxMixPercent: RedactedTaxMixPercentSchema.optional(),
});
export type RedactedTaxEstimate = z.infer<typeof RedactedTaxEstimateSchema>;

export const RedactedContributionLimitStatusSchema = z.object({
  type: ContributionTypeSchema,
  memberId: z.string().optional(),
  contributionUsedPercent: z.number().optional(),
});
export type RedactedContributionLimitStatus = z.infer<
  typeof RedactedContributionLimitStatusSchema
>;

export const RedactedTaxProfileSchema = TaxProfileSchema.omit({
  householdId: true,
  inputs: true,
  withholding: true,
  estimatedPayments: true,
  contributionLimits: true,
  lastEstimate: true,
}).extend({
  contributionLimits: z.array(RedactedContributionLimitStatusSchema).optional(),
  lastEstimate: RedactedTaxEstimateSchema.optional(),
});
export type RedactedTaxProfile = z.infer<typeof RedactedTaxProfileSchema>;

export const RedactedStrategySchema = StrategySchema.omit({
  estimatedSavings: true,
});
export type RedactedStrategy = z.infer<typeof RedactedStrategySchema>;

export const RedactedHouseholdSchema = HouseholdSchema.omit({
  netWorthSummary: true,
  monthlySpendSummary: true,
});
export type RedactedHousehold = z.infer<typeof RedactedHouseholdSchema>;

export const FreedomScoreLockedResponseSchema = z.object({
  privacyMode: z.literal("locked"),
  valuesUnlocked: z.literal(false),
  score: z.number().int().min(0).max(100).nullable(),
});
export type FreedomScoreLockedResponse = z.infer<
  typeof FreedomScoreLockedResponseSchema
>;

export const FreedomScoreUnlockedResponseSchema =
  FreedomScoreLockedResponseSchema.extend({
    privacyMode: z.literal("unlocked"),
    valuesUnlocked: z.literal(true),
    annualIncome: z.number(),
    annualExpenses: z.number(),
  });
export type FreedomScoreUnlockedResponse = z.infer<
  typeof FreedomScoreUnlockedResponseSchema
>;

export const FreedomScoreResponseSchema = z.discriminatedUnion("privacyMode", [
  FreedomScoreLockedResponseSchema,
  FreedomScoreUnlockedResponseSchema,
]);
export type FreedomScoreResponse = z.infer<typeof FreedomScoreResponseSchema>;

export const DashboardAnalyticsLockedResponseSchema = z.object({
  privacyMode: z.literal("locked"),
  valuesUnlocked: z.literal(false),
  allocation: z.array(PercentAllocationSliceSchema),
  spendByCategoryPercent: z.record(z.string(), z.number()),
  transactionCount: z.number().int().nonnegative(),
  accountSections: z.array(PercentAllocationSliceSchema),
  uninvestedCashPercent: z.number(),
  freedomScore: FreedomScoreLockedResponseSchema,
});
export type DashboardAnalyticsLockedResponse = z.infer<
  typeof DashboardAnalyticsLockedResponseSchema
>;

export const DashboardAnalyticsUnlockedResponseSchema =
  DashboardAnalyticsLockedResponseSchema.extend({
    privacyMode: z.literal("unlocked"),
    valuesUnlocked: z.literal(true),
    freedomScore: FreedomScoreUnlockedResponseSchema,
    netWorth: z.number(),
    uninvestedCash: z.number(),
  });
export type DashboardAnalyticsUnlockedResponse = z.infer<
  typeof DashboardAnalyticsUnlockedResponseSchema
>;

export const DashboardAnalyticsResponseSchema = z.discriminatedUnion(
  "privacyMode",
  [DashboardAnalyticsLockedResponseSchema, DashboardAnalyticsUnlockedResponseSchema]
);
export type DashboardAnalyticsResponse = z.infer<
  typeof DashboardAnalyticsResponseSchema
>;

export const HoldingListViewResponseSchema = z.discriminatedUnion("privacyMode", [
  z.object({
    privacyMode: z.literal("locked"),
    valuesUnlocked: z.literal(false),
    holdings: z.array(RedactedHoldingSchema),
  }),
  z.object({
    privacyMode: z.literal("unlocked"),
    valuesUnlocked: z.literal(true),
    holdings: z.array(HoldingSchema),
  }),
]);
export type HoldingListViewResponse = z.infer<
  typeof HoldingListViewResponseSchema
>;

export const AccountListViewResponseSchema = z.discriminatedUnion("privacyMode", [
  z.object({
    privacyMode: z.literal("locked"),
    valuesUnlocked: z.literal(false),
    accounts: z.array(RedactedAccountSchema),
  }),
  z.object({
    privacyMode: z.literal("unlocked"),
    valuesUnlocked: z.literal(true),
    accounts: z.array(AccountSchema),
  }),
]);
export type AccountListViewResponse = z.infer<
  typeof AccountListViewResponseSchema
>;

export const TransactionListViewResponseSchema = z.discriminatedUnion(
  "privacyMode",
  [
    z.object({
      privacyMode: z.literal("locked"),
      valuesUnlocked: z.literal(false),
      transactions: z.array(RedactedTransactionSchema),
      hasMore: z.boolean(),
      nextCursor: z.string().optional(),
    }),
    z.object({
      privacyMode: z.literal("unlocked"),
      valuesUnlocked: z.literal(true),
      transactions: z.array(TransactionSchema),
      hasMore: z.boolean(),
      nextCursor: z.string().optional(),
    }),
  ]
);
export type TransactionListViewResponse = z.infer<
  typeof TransactionListViewResponseSchema
>;
