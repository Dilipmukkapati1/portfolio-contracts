import { z } from "zod";

export const ScenarioStatusSchema = z.enum(["draft", "ready", "archived"]);
export type ScenarioStatus = z.infer<typeof ScenarioStatusSchema>;

export const ScenarioAssumptionsSchema = z.object({
  incomeDelta: z.number().optional(),
  extra401k: z.number().optional(),
  rothConversion: z.number().optional(),
  saleOfAsset: z
    .object({
      symbol: z.string(),
      amount: z.number(),
      longTerm: z.boolean(),
    })
    .optional(),
  retirementYear: z.number().int().optional(),
});
export type ScenarioAssumptions = z.infer<typeof ScenarioAssumptionsSchema>;

/** Schema-only: what-if scenarios referencing a base TaxProfile (Phase 2+). */
export const ScenarioSchema = z.object({
  id: z.string().min(1),
  householdId: z.string().min(1),
  name: z.string().min(1),
  baseTaxYear: z.number().int(),
  baseTaxProfileId: z.string().min(1),
  assumptions: ScenarioAssumptionsSchema.default({}),
  status: ScenarioStatusSchema.default("draft"),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Scenario = z.infer<typeof ScenarioSchema>;
