import { z } from "zod";
import {
  AccountSourceSchema,
  TransactionCategorySchema,
  TransactionCategorySourceSchema,
} from "../enums.js";

export const TransactionSchema = z.object({
  id: z.string(),
  householdId: z.string(),
  txnId: z.string(),
  accountId: z.string(),
  accountName: z.string().optional(),
  source: AccountSourceSchema.default("simplefin"),
  amount: z.number(),
  currency: z.string().default("USD"),
  date: z.string(),
  transactedAt: z.string().datetime().optional(),
  postedAt: z.string().datetime().optional(),
  description: z.string(),
  memo: z.string().optional(),
  merchant: z.string().optional(),
  category: TransactionCategorySchema.default("uncategorized"),
  categorySource: TransactionCategorySourceSchema.default("auto"),
  providerCategory: z.string().optional(),
  pending: z.boolean().default(false),
  externalId: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Transaction = z.infer<typeof TransactionSchema>;

export const CategorizeTransactionRequestSchema = z.object({
  txnId: z.string(),
  category: TransactionCategorySchema,
});
export type CategorizeTransactionRequest = z.infer<
  typeof CategorizeTransactionRequestSchema
>;

export const TransactionFilterSchema = z.object({
  accountId: z.string().optional(),
  category: TransactionCategorySchema.optional(),
  source: AccountSourceSchema.optional(),
  pending: z.boolean().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.number().int().positive().max(500).default(100),
  cursor: z.string().optional(),
});
export type TransactionFilter = z.infer<typeof TransactionFilterSchema>;

export const TransactionListResponseSchema = z.object({
  transactions: z.array(TransactionSchema),
  hasMore: z.boolean(),
  nextCursor: z.string().optional(),
});
export type TransactionListResponse = z.infer<
  typeof TransactionListResponseSchema
>;

export const TransactionSummaryRequestSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  accountId: z.string().optional(),
});
export type TransactionSummaryRequest = z.infer<
  typeof TransactionSummaryRequestSchema
>;

export const TransactionSummaryResponseSchema = z.object({
  totalCredits: z.number(),
  totalSpend: z.number(),
  spendByCategory: z.record(z.string(), z.number()),
  spendByAccount: z.record(z.string(), z.number()).default({}),
  spendByCategoryPercent: z.record(z.string(), z.number()).optional(),
  transactionCount: z.number().int().nonnegative(),
});
export type TransactionSummaryResponse = z.infer<
  typeof TransactionSummaryResponseSchema
>;
