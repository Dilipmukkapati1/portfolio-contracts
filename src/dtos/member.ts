import { z } from "zod";
import {
  ContributionAmountModeSchema,
  ContributionTypeSchema,
  IncomeAmountModeSchema,
  IncomeSourceTypeSchema,
  MemberRelationshipSchema,
} from "../enums.js";

export const IncomeLineItemSchema = z.object({
  id: z.string().min(1),
  type: IncomeSourceTypeSchema,
  amount: z.number().min(0),
  label: z.string().optional(),
  amountMode: IncomeAmountModeSchema.optional(),
  percent: z.number().min(0).max(100).optional(),
});
export type IncomeLineItem = z.infer<typeof IncomeLineItemSchema>;

export const ContributionLineItemSchema = z.object({
  id: z.string().min(1),
  type: ContributionTypeSchema,
  amount: z.number().min(0),
  label: z.string().optional(),
  amountMode: ContributionAmountModeSchema.optional(),
  percent: z.number().min(0).max(100).optional(),
});
export type ContributionLineItem = z.infer<typeof ContributionLineItemSchema>;

export const MemberSchema = z.object({
  id: z.string().min(1),
  householdId: z.string().min(1),
  name: z.string().min(1),
  relationship: MemberRelationshipSchema,
  dateOfBirth: z.string().optional(),
  userId: z.string().optional(),
  isActive: z.boolean().default(true),
  incomeSources: z.array(IncomeLineItemSchema).default([]),
  contributions: z.array(ContributionLineItemSchema).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Member = z.infer<typeof MemberSchema>;

export const CreateMemberRequestSchema = z.object({
  name: z.string().min(1),
  relationship: MemberRelationshipSchema,
  dateOfBirth: z.string().optional(),
  userId: z.string().optional(),
  isActive: z.boolean().default(true),
  incomeSources: z.array(IncomeLineItemSchema).default([]),
  contributions: z.array(ContributionLineItemSchema).default([]),
});
export type CreateMemberRequest = z.infer<typeof CreateMemberRequestSchema>;

export const UpdateMemberRequestSchema = CreateMemberRequestSchema.partial();
export type UpdateMemberRequest = z.infer<typeof UpdateMemberRequestSchema>;

export const MemberListResponseSchema = z.object({
  members: z.array(MemberSchema),
});
export type MemberListResponse = z.infer<typeof MemberListResponseSchema>;

export const SaveMembersRequestSchema = z.object({
  members: z.array(
    z.object({
      id: z.string().optional(),
      name: z.string().min(1),
      relationship: MemberRelationshipSchema,
      dateOfBirth: z.string().optional(),
      userId: z.string().optional(),
      isActive: z.boolean().default(true),
      incomeSources: z.array(IncomeLineItemSchema).default([]),
      contributions: z.array(ContributionLineItemSchema).default([]),
    })
  ),
});
export type SaveMembersRequest = z.infer<typeof SaveMembersRequestSchema>;
