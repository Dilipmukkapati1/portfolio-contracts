import { z } from "zod";
import { AccountSourceSchema } from "../enums.js";

export const AccountSchema = z.object({
  id: z.string(),
  householdId: z.string(),
  accountId: z.string(),
  source: AccountSourceSchema,
  externalId: z.string().optional(),
  displayName: z.string(),
  institutionName: z.string().optional(),
  accountType: z.string().optional(),
  currency: z.string().default("USD"),
  balance: z.number().optional(),
  isActive: z.boolean().default(true),
  lastSyncedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Account = z.infer<typeof AccountSchema>;
