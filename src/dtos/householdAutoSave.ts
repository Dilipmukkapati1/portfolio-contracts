import { z } from "zod";
import type { ContributionType, FilingStatus } from "../enums.js";
import {
  ContributionTypeSchema,
  FilingStatusSchema,
  IncomeSourceTypeSchema,
  MemberRelationshipSchema,
  PersonaSchema,
} from "../enums.js";
import type { Member } from "./member.js";
import type { ContributionLineItem, IncomeLineItem } from "./member.js";
import type { TaxRuleLimits } from "../taxAggregation.js";

export const HouseholdAutoSaveChangeSchema = z.object({
  field: z.string(),
  label: z.string(),
  before: z.string().optional(),
  after: z.string().optional(),
});
export type HouseholdAutoSaveChange = z.infer<typeof HouseholdAutoSaveChangeSchema>;

export const HouseholdAutoSaveResultSchema = z.object({
  enabled: z.boolean(),
  attempted: z.boolean(),
  applied: z.boolean(),
  changes: z.array(HouseholdAutoSaveChangeSchema).default([]),
  skippedReason: z.string().optional(),
});
export type HouseholdAutoSaveResult = z.infer<typeof HouseholdAutoSaveResultSchema>;

export const HouseholdAutoSaveIncomePatchSchema = z.object({
  type: IncomeSourceTypeSchema,
  amount: z.number().optional(),
  period: z.enum(["annual", "monthly"]).default("annual"),
  updateMode: z.enum(["set", "add"]).default("set"),
});
export type HouseholdAutoSaveIncomePatch = z.infer<
  typeof HouseholdAutoSaveIncomePatchSchema
>;

export const HouseholdAutoSaveContributionPatchSchema = z.object({
  type: ContributionTypeSchema,
  amount: z.number().optional(),
  amountExpression: z.enum(["explicit", "max", "half_max"]).default("explicit"),
  updateMode: z.enum(["set", "add"]).default("set"),
});
export type HouseholdAutoSaveContributionPatch = z.infer<
  typeof HouseholdAutoSaveContributionPatchSchema
>;

export const HouseholdAutoSaveMemberPatchSchema = z.object({
  matchName: z.string(),
  name: z.string().optional(),
  relationship: MemberRelationshipSchema.optional(),
  remove: z.boolean().optional(),
  incomeSources: z.array(HouseholdAutoSaveIncomePatchSchema).optional(),
  contributions: z.array(HouseholdAutoSaveContributionPatchSchema).optional(),
});
export type HouseholdAutoSaveMemberPatch = z.infer<
  typeof HouseholdAutoSaveMemberPatchSchema
>;

export const HouseholdAutoSavePatchSchema = z
  .object({
    displayName: z.string().nullable().optional(),
    primaryState: z.string().length(2).nullable().optional(),
    persona: PersonaSchema.nullable().optional(),
    filingStatus: FilingStatusSchema.nullable().optional(),
    defaultTaxYear: z.number().int().nullable().optional(),
    members: z.array(HouseholdAutoSaveMemberPatchSchema).optional().nullable(),
  })
  .strip();
export type HouseholdAutoSavePatch = z.infer<typeof HouseholdAutoSavePatchSchema>;

/** Parse LLM or rule-based patch payloads (strips unknown keys). */
export function parseHouseholdAutoSavePatch(value: unknown): HouseholdAutoSavePatch {
  return HouseholdAutoSavePatchSchema.parse(value);
}

function activeEarners(members: Member[]): Member[] {
  return members.filter((m) => m.isActive && m.relationship !== "dependent");
}

function contributionTargetsForMessage(
  message: string,
  members: Member[]
): Member[] {
  const earners = activeEarners(members);
  if (earners.length === 0) return [];

  const lower = message.toLowerCase();
  const householdScope = /\b(we|our|both|us)\b/.test(lower);

  if (householdScope && earners.length > 1) {
    const couple = earners.filter(
      (m) => m.relationship === "self" || m.relationship === "spouse"
    );
    if (couple.length > 0) return couple;
    return earners;
  }

  if (/\b(spouse|wife|husband|partner)\b/.test(lower)) {
    const spouse = earners.find((m) => m.relationship === "spouse");
    if (spouse) return [spouse];
  }

  const self = earners.find((m) => m.relationship === "self");
  if (self) return [self];
  return [earners[0]!];
}

function mentionsMax401k(message: string): boolean {
  if (!/(401\s*\(?k|401k)/i.test(message)) return false;
  return (
    /\bmax(ed|ing)?\b/i.test(message) ||
    /\bmax\s*out\b/i.test(message) ||
    /\bhit\s*(the\s*)?limit\b/i.test(message) ||
    /\bcontributed\s*(the\s*)?(full|max)/i.test(message)
  );
}

function mentionsMaxHsa(message: string): boolean {
  if (!/\bhsa\b/i.test(message)) return false;
  return (
    /\bmax(ed|ing)?\b/i.test(message) ||
    /\bmax\s*out\b/i.test(message) ||
    /\bhit\s*(the\s*)?limit\b/i.test(message)
  );
}

function parseMoneyAmount(dollars: string, suffix?: string): number | null {
  const base = Number.parseFloat(dollars.replace(/,/g, ""));
  if (Number.isNaN(base)) return null;
  const s = suffix?.toLowerCase();
  const multiplier = s === "k" ? 1000 : s === "m" ? 1_000_000 : 1;
  return Math.round(base * multiplier);
}

function inferIncomeFromMessage(
  message: string
): { amount: number; period: "annual" | "monthly" } | null {
  const monthlyMatch = message.match(
    /\$\s*([\d,]+(?:\.\d+)?)\s*(k|K|m|M)?\s*(?:\/\s*mo(?:nth)?|per\s*month|monthly|a\s*month)/i
  );
  if (monthlyMatch) {
    const amount = parseMoneyAmount(monthlyMatch[1]!, monthlyMatch[2]);
    if (amount != null) return { amount, period: "monthly" };
  }

  const labeledMatch = message.match(
    /\b(?:salary|wage|wages|income|earn|make|paid)\b[^.\n]{0,30}\$\s*([\d,]+(?:\.\d+)?)\s*(k|K|m|M)?/i
  );
  if (labeledMatch) {
    const amount = parseMoneyAmount(labeledMatch[1]!, labeledMatch[2]);
    if (amount != null) return { amount, period: "annual" };
  }

  const dollarMatch = message.match(
    /\$\s*([\d,]+(?:\.\d+)?)\s*(k|K|m|M)?(?:\s*(?:\/\s*(?:yr|year)|(?:per|a)\s*year|\s+salary))?/i
  );
  if (dollarMatch && /\b(salary|wage|income|earn|make)\b/i.test(message)) {
    const amount = parseMoneyAmount(dollarMatch[1]!, dollarMatch[2]);
    if (amount != null) return { amount, period: "annual" };
  }

  const compactMatch = message.match(
    /\b(?:salary|wage|income)\s+\$?\s*([\d,]+(?:\.\d+)?)\s*(k|K|m|M)?\b/i
  );
  if (compactMatch) {
    const amount = parseMoneyAmount(compactMatch[1]!, compactMatch[2]);
    if (amount != null) return { amount, period: "annual" };
  }

  return null;
}

function inferContributionType(message: string): ContributionType | null {
  if (/(401\s*\(?k|401k)/i.test(message)) return "401k";
  if (/(403\s*\(?b|403b)/i.test(message)) return "403b";
  if (/\bhsa\b/i.test(message)) return "hsa";
  if (/\broth\s*ira\b/i.test(message)) return "roth_ira";
  if (/\b(traditional\s*)?ira\b/i.test(message)) return "traditional_ira";
  return null;
}

function inferExplicitContributionFromMessage(
  message: string
): { type: ContributionType; amount: number } | null {
  const type = inferContributionType(message);
  if (!type) return null;
  if (mentionsMax401k(message) || mentionsMaxHsa(message)) return null;

  const monthlyMatch = message.match(
    /\$\s*([\d,]+(?:\.\d+)?)\s*(k|K|m|M)?\s*(?:\/\s*mo(?:nth)?|per\s*month|monthly|a\s*month)/i
  );
  if (monthlyMatch) {
    const monthly = parseMoneyAmount(monthlyMatch[1]!, monthlyMatch[2]);
    if (monthly != null) return { type, amount: monthly * 12 };
  }

  const contribMatch = message.match(
    /\b(?:contribute|contribution|putting|defer)\w*\s+[^.\n]{0,20}\$\s*([\d,]+(?:\.\d+)?)\s*(k|K|m|M)?/i
  );
  if (contribMatch) {
    const amount = parseMoneyAmount(contribMatch[1]!, contribMatch[2]);
    if (amount != null) return { type, amount };
  }

  const toAccountMatch = message.match(
    /\$\s*([\d,]+(?:\.\d+)?)\s*(k|K|m|M)?\s+to\s+(?:my\s+)?(?:401\s*\(?k|401k|403\s*\(?b|403b|hsa|ira)/i
  );
  if (toAccountMatch) {
    const amount = parseMoneyAmount(toAccountMatch[1]!, toAccountMatch[2]);
    if (amount != null) return { type, amount };
  }

  return null;
}

function mergeMemberPatch(
  base: HouseholdAutoSaveMemberPatch,
  extra: HouseholdAutoSaveMemberPatch
): HouseholdAutoSaveMemberPatch {
  return {
    ...base,
    ...extra,
    incomeSources: [...(base.incomeSources ?? []), ...(extra.incomeSources ?? [])],
    contributions: [
      ...(base.contributions ?? []),
      ...(extra.contributions ?? []),
    ],
  };
}

/** Rule-based extraction when the LLM fails or omits obvious updates. */
export function inferMemberPatchesFromMessage(
  message: string,
  members: Member[]
): HouseholdAutoSaveMemberPatch[] {
  const targets = contributionTargetsForMessage(message, members);
  if (targets.length === 0) return [];

  const byMemberId = new Map<string, HouseholdAutoSaveMemberPatch>();
  const income = inferIncomeFromMessage(message);
  const explicitContribution = inferExplicitContributionFromMessage(message);

  for (const member of targets) {
    let patch: HouseholdAutoSaveMemberPatch = {
      matchName: member.name,
      relationship: member.relationship,
    };

    if (mentionsMax401k(message)) {
      patch = mergeMemberPatch(patch, {
        matchName: member.name,
        relationship: member.relationship,
        contributions: [
          { type: "401k", amountExpression: "max", updateMode: "set" },
        ],
      });
    }

    if (mentionsMaxHsa(message)) {
      patch = mergeMemberPatch(patch, {
        matchName: member.name,
        relationship: member.relationship,
        contributions: [
          { type: "hsa", amountExpression: "max", updateMode: "set" },
        ],
      });
    }

    if (income) {
      patch = mergeMemberPatch(patch, {
        matchName: member.name,
        relationship: member.relationship,
        incomeSources: [
          {
            type: "wages",
            amount: income.amount,
            period: income.period,
            updateMode: "set",
          },
        ],
      });
    }

    if (explicitContribution) {
      patch = mergeMemberPatch(patch, {
        matchName: member.name,
        relationship: member.relationship,
        contributions: [
          {
            type: explicitContribution.type,
            amount: explicitContribution.amount,
            amountExpression: "explicit",
            updateMode: "set",
          },
        ],
      });
    }

    if (
      (patch.incomeSources?.length ?? 0) > 0 ||
      (patch.contributions?.length ?? 0) > 0
    ) {
      byMemberId.set(member.id, patch);
    }
  }

  return Array.from(byMemberId.values());
}

function memberPatchKey(patch: HouseholdAutoSaveMemberPatch): string {
  return `${normalizeMatchName(patch.matchName)}:${patch.relationship ?? ""}`;
}

/** Merge rule-based patches into an LLM patch (fills gaps only). */
export function enrichPatchWithInferredMembers(
  patch: HouseholdAutoSavePatch,
  inferred: HouseholdAutoSaveMemberPatch[]
): HouseholdAutoSavePatch {
  if (inferred.length === 0) return patch;

  const existing = patch.members ?? [];
  const covered = new Set(existing.map(memberPatchKey));
  const merged = [...existing];

  for (const inferredPatch of inferred) {
    const key = memberPatchKey(inferredPatch);
    const existingIdx = merged.findIndex((p) => memberPatchKey(p) === key);

    if (existingIdx === -1 && !covered.has(key)) {
      merged.push(inferredPatch);
      covered.add(key);
      continue;
    }

    if (existingIdx === -1) continue;

    const current = merged[existingIdx]!;
    const existingContribTypes = new Set(
      (current.contributions ?? []).map((c) => c.type)
    );
    const missingContribs = (inferredPatch.contributions ?? []).filter(
      (c) => !existingContribTypes.has(c.type)
    );
    if (missingContribs.length === 0) continue;

    merged[existingIdx] = {
      ...current,
      contributions: [...(current.contributions ?? []), ...missingContribs],
    };
  }

  return { ...patch, members: merged };
}

export interface ResolveContributionContext {
  taxYear: number;
  filingStatus: FilingStatus;
  dependentCount: number;
  rules: TaxRuleLimits;
}

const RETIREMENT_TYPES: ContributionType[] = [
  "401k",
  "403b",
  "traditional_ira",
  "sep_ira",
  "solo_401k",
  "simple_ira",
];

function newLineId(): string {
  return `line-${crypto.randomUUID()}`;
}

function normalizeMatchName(name: string): string {
  return name.trim().toLowerCase();
}

const MATCH_NAME_RELATIONSHIP: Record<string, Member["relationship"]> = {
  self: "self",
  primary: "self",
  me: "self",
  i: "self",
  spouse: "spouse",
  partner: "spouse",
  wife: "spouse",
  husband: "spouse",
};

function findMemberIndex(
  members: Member[],
  patch: HouseholdAutoSaveMemberPatch
): number {
  const match = normalizeMatchName(patch.matchName);
  const byId = members.findIndex((m) => m.id === patch.matchName);
  if (byId >= 0) return byId;

  const aliasRelationship = MATCH_NAME_RELATIONSHIP[match];
  if (aliasRelationship) {
    const byAlias = members.findIndex(
      (m) => m.isActive && m.relationship === aliasRelationship
    );
    if (byAlias >= 0) return byAlias;
  }

  const byName = members.findIndex(
    (m) => normalizeMatchName(m.name) === match
  );
  if (byName >= 0) return byName;

  if (patch.relationship) {
    const byRel = members.findIndex(
      (m) => m.isActive && m.relationship === patch.relationship
    );
    if (byRel >= 0) return byRel;
  }

  return -1;
}

export function annualizeIncomeAmount(
  amount: number,
  period: "annual" | "monthly"
): number {
  if (period === "monthly") return Math.round(amount * 12);
  return amount;
}

export function resolveContributionAmount(
  type: ContributionType,
  expression: "explicit" | "max" | "half_max",
  explicitAmount: number | undefined,
  ctx: ResolveContributionContext
): number {
  const retirementLimit = ctx.rules.retirement401kLimit ?? 23500;
  const hsaSingle = ctx.rules.hsaSingleLimit ?? 4300;
  const hsaFamily = ctx.rules.hsaFamilyLimit ?? 8550;
  const useFamilyHsa =
    ctx.filingStatus === "married_filing_jointly" || ctx.dependentCount > 0;

  let limit: number;
  if (type === "hsa") {
    limit = useFamilyHsa ? hsaFamily : hsaSingle;
  } else if (RETIREMENT_TYPES.includes(type)) {
    limit = retirementLimit;
  } else {
    limit = explicitAmount ?? 0;
    if (expression === "max") return limit;
    if (expression === "half_max") return Math.round(limit / 2);
    return Math.max(0, explicitAmount ?? 0);
  }

  if (expression === "max") return limit;
  if (expression === "half_max") return Math.round(limit / 2);
  return Math.max(0, explicitAmount ?? 0);
}

function upsertIncomeLine(
  existing: IncomeLineItem[],
  patch: HouseholdAutoSaveIncomePatch
): IncomeLineItem[] {
  const amount = annualizeIncomeAmount(patch.amount ?? 0, patch.period);
  const idx = existing.findIndex((line) => line.type === patch.type);
  if (idx === -1) {
    return [
      ...existing,
      { id: newLineId(), type: patch.type, amount: Math.max(0, amount) },
    ];
  }
  const line = existing[idx]!;
  const nextAmount =
    patch.updateMode === "add"
      ? Math.max(0, line.amount + amount)
      : Math.max(0, amount);
  return existing.map((l, i) =>
    i === idx ? { ...l, amount: nextAmount } : l
  );
}

function upsertContributionLine(
  existing: ContributionLineItem[],
  patch: HouseholdAutoSaveContributionPatch,
  ctx: ResolveContributionContext
): ContributionLineItem[] {
  const amount = resolveContributionAmount(
    patch.type,
    patch.amountExpression,
    patch.amount,
    ctx
  );
  const idx = existing.findIndex((line) => line.type === patch.type);
  if (idx === -1) {
    return [
      ...existing,
      { id: newLineId(), type: patch.type, amount: Math.max(0, amount) },
    ];
  }
  const line = existing[idx]!;
  const nextAmount =
    patch.updateMode === "add"
      ? Math.max(0, line.amount + amount)
      : Math.max(0, amount);
  return existing.map((l, i) =>
    i === idx ? { ...l, amount: nextAmount } : l
  );
}

function createMemberFromPatch(
  householdId: string,
  patch: HouseholdAutoSaveMemberPatch,
  ctx: ResolveContributionContext
): Member {
  const now = new Date().toISOString();
  let incomeSources: IncomeLineItem[] = [];
  let contributions: ContributionLineItem[] = [];

  for (const income of patch.incomeSources ?? []) {
    incomeSources = upsertIncomeLine(incomeSources, income);
  }
  for (const contrib of patch.contributions ?? []) {
    contributions = upsertContributionLine(contributions, contrib, ctx);
  }

  return {
    id: newLineId(),
    householdId,
    name: (patch.name ?? patch.matchName).trim(),
    relationship: patch.relationship ?? "other",
    isActive: true,
    incomeSources,
    contributions,
    createdAt: now,
    updatedAt: now,
  };
}

export function mergeMemberPatches(
  existing: Member[],
  patches: HouseholdAutoSaveMemberPatch[],
  options: { householdId: string; contributionContext: ResolveContributionContext }
): Member[] {
  let members = existing.map((m) => ({
    ...m,
    incomeSources: [...(m.incomeSources ?? [])],
    contributions: [...(m.contributions ?? [])],
  }));

  for (const patch of patches) {
    if (patch.remove) {
      const idx = findMemberIndex(members, patch);
      if (idx >= 0) {
        members = members.filter((_, i) => i !== idx);
      }
      continue;
    }

    const idx = findMemberIndex(members, patch);
    if (idx === -1) {
      members.push(
        createMemberFromPatch(options.householdId, patch, options.contributionContext)
      );
      continue;
    }

    const member = members[idx]!;
    const updated: Member = {
      ...member,
      name: patch.name?.trim() || member.name,
      relationship: patch.relationship ?? member.relationship,
      updatedAt: new Date().toISOString(),
    };

    let incomeSources = [...(updated.incomeSources ?? [])];
    for (const income of patch.incomeSources ?? []) {
      incomeSources = upsertIncomeLine(incomeSources, income);
    }

    let contributions = [...(updated.contributions ?? [])];
    for (const contrib of patch.contributions ?? []) {
      contributions = upsertContributionLine(
        contributions,
        contrib,
        options.contributionContext
      );
    }

    members[idx] = { ...updated, incomeSources, contributions };
  }

  return members;
}
