import { z } from "zod";
import { TaxEstimateSchema, StrategySchema } from "./tax.js";

export const ProjectionJobTypeSchema = z.enum([
  "tax_projection",
  "networth_projection",
  "monte_carlo",
]);
export type ProjectionJobType = z.infer<typeof ProjectionJobTypeSchema>;

export const ProjectionRunStatusSchema = z.enum([
  "queued",
  "running",
  "complete",
  "failed",
]);
export type ProjectionRunStatus = z.infer<typeof ProjectionRunStatusSchema>;

export const ProjectionRunResultsSchema = z.object({
  taxEstimates: z.array(TaxEstimateSchema).optional(),
  netWorthSeries: z
    .array(
      z.object({
        date: z.string(),
        value: z.number(),
      })
    )
    .optional(),
  strategies: z.array(StrategySchema).optional(),
});
export type ProjectionRunResults = z.infer<typeof ProjectionRunResultsSchema>;

/** Schema-only: batch projection output (Phase 2+). */
export const ProjectionRunSchema = z.object({
  id: z.string().min(1),
  householdId: z.string().min(1),
  scenarioId: z.string().min(1),
  jobType: ProjectionJobTypeSchema,
  status: ProjectionRunStatusSchema,
  inputsHash: z.string().optional(),
  results: ProjectionRunResultsSchema.optional(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  error: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ProjectionRun = z.infer<typeof ProjectionRunSchema>;
