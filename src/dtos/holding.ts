import { z } from "zod";

export const HoldingSchema = z.object({
  id: z.string(),
  householdId: z.string(),
  holdingId: z.string(),
  accountId: z.string(),
  symbol: z.string(),
  description: z.string().optional(),
  quantity: z.number(),
  price: z.number().optional(),
  marketValue: z.number().optional(),
  costBasis: z.number().optional(),
  currency: z.string().default("USD"),
  assetClass: z.string().optional(),
  lastSyncedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Holding = z.infer<typeof HoldingSchema>;
