import { z } from "zod";
import { TransactionCategorySchema } from "../enums.js";

export const TransactionSchema = z.object({
  id: z.string(),
  householdId: z.string(),
  txnId: z.string(),
  accountId: z.string(),
  amount: z.number(),
  date: z.string(),
  description: z.string(),
  merchant: z.string().optional(),
  category: TransactionCategorySchema.default("uncategorized"),
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
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.number().int().positive().max(500).default(100),
});
export type TransactionFilter = z.infer<typeof TransactionFilterSchema>;
