import { z } from "zod";

/** Schema-only: cost basis lots for capital gains / wash sale (Phase 2+). */
export const TaxLotSchema = z.object({
  id: z.string().min(1),
  householdId: z.string().min(1),
  accountId: z.string().min(1),
  symbol: z.string().min(1),
  quantity: z.number(),
  costBasisPerShare: z.number(),
  acquiredDate: z.string(),
  washSaleWindow: z
    .object({
      disallowedUntil: z.string(),
    })
    .optional(),
  source: z.enum(["sync", "manual", "import"]).default("manual"),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type TaxLot = z.infer<typeof TaxLotSchema>;
