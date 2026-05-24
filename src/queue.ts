import { z } from "zod";

export const SyncSimplefinMessageSchema = z.object({
  type: z.literal("sync.simplefin"),
  householdId: z.string(),
});
export type SyncSimplefinMessage = z.infer<typeof SyncSimplefinMessageSchema>;

export const SyncSnaptradeMessageSchema = z.object({
  type: z.literal("sync.snaptrade"),
  householdId: z.string(),
  accountId: z.string().optional(),
});
export type SyncSnaptradeMessage = z.infer<typeof SyncSnaptradeMessageSchema>;

export const CategorizeTransactionsMessageSchema = z.object({
  type: z.literal("categorize.transactions"),
  householdId: z.string(),
});
export type CategorizeTransactionsMessage = z.infer<
  typeof CategorizeTransactionsMessageSchema
>;

export const RecomputeNetworthMessageSchema = z.object({
  type: z.literal("recompute.networth"),
  householdId: z.string(),
});
export type RecomputeNetworthMessage = z.infer<
  typeof RecomputeNetworthMessageSchema
>;

export const RunBatchProjectionMessageSchema = z.object({
  type: z.literal("run.batch.projection"),
  householdId: z.string(),
  scenarioId: z.string(),
});
export type RunBatchProjectionMessage = z.infer<
  typeof RunBatchProjectionMessageSchema
>;

export const RecomputeTaxProfileMessageSchema = z.object({
  type: z.literal("recompute.taxProfile"),
  householdId: z.string(),
  taxYear: z.number().int().optional(),
});
export type RecomputeTaxProfileMessage = z.infer<
  typeof RecomputeTaxProfileMessageSchema
>;

export const RollupMonthlySpendMessageSchema = z.object({
  type: z.literal("rollup.monthlySpend"),
  householdId: z.string(),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
});
export type RollupMonthlySpendMessage = z.infer<
  typeof RollupMonthlySpendMessageSchema
>;

export const QueueMessageSchema = z.discriminatedUnion("type", [
  SyncSimplefinMessageSchema,
  SyncSnaptradeMessageSchema,
  CategorizeTransactionsMessageSchema,
  RecomputeNetworthMessageSchema,
  RunBatchProjectionMessageSchema,
  RecomputeTaxProfileMessageSchema,
  RollupMonthlySpendMessageSchema,
]);
export type QueueMessage = z.infer<typeof QueueMessageSchema>;

export function parseQueueMessage(raw: string): QueueMessage {
  const json: unknown = JSON.parse(raw);
  return QueueMessageSchema.parse(json);
}

export function serializeQueueMessage(message: QueueMessage): string {
  return JSON.stringify(message);
}
