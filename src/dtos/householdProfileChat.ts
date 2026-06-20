import { z } from "zod";
import { AdvisorAutoSaveResultSchema } from "./advisor.js";

export const HouseholdProfileChatMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  createdAt: z.string(),
});
export type HouseholdProfileChatMessage = z.infer<
  typeof HouseholdProfileChatMessageSchema
>;

export const HouseholdProfileChatRequestSchema = z.object({
  message: z.string().min(1).max(8000),
});
export type HouseholdProfileChatRequest = z.infer<
  typeof HouseholdProfileChatRequestSchema
>;

export const HouseholdProfileChatResponseSchema = z.object({
  message: HouseholdProfileChatMessageSchema,
  autoSave: AdvisorAutoSaveResultSchema,
});
export type HouseholdProfileChatResponse = z.infer<
  typeof HouseholdProfileChatResponseSchema
>;
