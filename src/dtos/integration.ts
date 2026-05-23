import { z } from "zod";
import { IntegrationProviderSchema, SyncStatusSchema } from "../enums.js";

export const IntegrationTokenSchema = z.object({
  id: z.string(),
  householdId: z.string(),
  provider: IntegrationProviderSchema,
  keyVaultSecretName: z.string(),
  externalUserId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type IntegrationToken = z.infer<typeof IntegrationTokenSchema>;

export const SyncStateSchema = z.object({
  id: z.string(),
  householdId: z.string(),
  provider: IntegrationProviderSchema,
  status: SyncStatusSchema,
  lastSyncedAt: z.string().datetime().optional(),
  dailyRequestCount: z.number().int().optional(),
  cursor: z.string().optional(),
  errorCount: z.number().int().default(0),
  lastError: z.string().optional(),
  updatedAt: z.string().datetime(),
});
export type SyncState = z.infer<typeof SyncStateSchema>;

export const ConnectSimplefinRequestSchema = z.object({
  setupToken: z.string().min(1),
});
export type ConnectSimplefinRequest = z.infer<
  typeof ConnectSimplefinRequestSchema
>;

export const ConnectSnaptradeRequestSchema = z.object({
  redirectUrl: z.string().url().optional(),
});
export type ConnectSnaptradeRequest = z.infer<
  typeof ConnectSnaptradeRequestSchema
>;
