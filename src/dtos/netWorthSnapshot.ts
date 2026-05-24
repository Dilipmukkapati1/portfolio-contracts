import { z } from "zod";

/** Schema-only: net worth time series (Phase 2+). */
export const NetWorthSnapshotSchema = z.object({
  id: z.string().min(1),
  householdId: z.string().min(1),
  asOfDate: z.string(),
  totalAssets: z.number(),
  totalLiabilities: z.number(),
  netWorth: z.number(),
  breakdown: z
    .object({
      cash: z.number().optional(),
      investments: z.number().optional(),
      retirement: z.number().optional(),
      liabilities: z.number().optional(),
    })
    .optional(),
  createdAt: z.string().datetime(),
});
export type NetWorthSnapshot = z.infer<typeof NetWorthSnapshotSchema>;
