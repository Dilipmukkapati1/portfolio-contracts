import { z } from "zod";
import type { ContributionType, FilingStatus } from "../enums.js";
import {
  ContributionAmountModeSchema,
  ContributionTypeSchema,
  FilingStatusSchema,
  IncomeAmountModeSchema,
  IncomeSourceTypeSchema,
  MemberRelationshipSchema,
  PersonaSchema,
} from "../enums.js";
import type { Member } from "./member.js";
import type { ContributionLineItem, IncomeLineItem } from "./member.js";
import type { TaxRuleLimits } from "../taxAggregation.js";
import {
  allocateHouseholdLimit,
  householdScopedContributionTypes,
  isHouseholdScopedType,
  normalizeHouseholdContributions,
  statutoryLimit,
  type LimitContext,
} from "../contributionLimits.js";
import {
  resolveMemberContributionAmount,
  resolveMemberIncomeAmounts,
} from "../memberIncome.js";

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
  amountMode: IncomeAmountModeSchema.optional(),
  percent: z.number().min(0).max(100).optional(),
});
export type HouseholdAutoSaveIncomePatch = z.infer<
  typeof HouseholdAutoSaveIncomePatchSchema
>;

export const HouseholdAutoSaveContributionPatchSchema = z.object({
  type: ContributionTypeSchema,
  amount: z.number().optional(),
  amountExpression: z.enum(["explicit", "max", "half_max"]).default("explicit"),
  updateMode: z.enum(["set", "add"]).default("set"),
  amountMode: ContributionAmountModeSchema.optional(),
  percent: z.number().min(0).max(100).optional(),
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
    liquidCashSnapshot: z.number().nullable().optional(),
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

function activeDependents(members: Member[]): Member[] {
  return members.filter((m) => m.isActive && m.relationship === "dependent");
}

function membersMatchingNameInMessage(
  message: string,
  members: Member[]
): Member[] {
  const lower = message.toLowerCase();
  return members.filter((m) => {
    if (!m.isActive) return false;
    const name = m.name.trim().toLowerCase();
    if (!name) return false;
    if (lower.includes(name)) return true;
    const first = name.split(/\s+/)[0]!;
    if (first.length < 2) return false;
    return new RegExp(`\\b${first.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(
      lower
    );
  });
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

function incomeTargetsForMessage(message: string, members: Member[]): Member[] {
  const lower = message.toLowerCase();
  const dependents = activeDependents(members);

  const childNameMatch = message.match(
    /\b(?:my\s+)?(?:son|daughter|kid|child)\s+([A-Z][a-z]+)/i
  );
  if (childNameMatch) {
    const name = childNameMatch[1]!;
    const dep = dependents.find(
      (m) => m.name.toLowerCase() === name.toLowerCase()
    );
    if (dep) return [dep];
    return [];
  }

  const namedDependentMatch = message.match(
    /\b([A-Z][a-z]+)\s+(?:earns?|made|makes?)\b/i
  );
  if (namedDependentMatch && /\b(kid|child|son|daughter|dependent)\b/i.test(message)) {
    const name = namedDependentMatch[1]!;
    const dep = dependents.find(
      (m) => m.name.toLowerCase() === name.toLowerCase()
    );
    if (dep) return [dep];
  }

  if (/\b(kid|kids|child|children|son|daughter|dependent)\b/i.test(lower)) {
    if (dependents.length === 1) return [dependents[0]!];
    if (dependents.length > 1 && namedDependentMatch) {
      const name = namedDependentMatch[1]!;
      const dep = dependents.find(
        (m) => m.name.toLowerCase() === name.toLowerCase()
      );
      if (dep) return [dep];
    }
  }

  const namedMembers = membersMatchingNameInMessage(message, members);
  if (namedMembers.length > 0) {
    return namedMembers;
  }

  return contributionTargetsForMessage(message, members);
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

function mentionsMaxDcfsa(message: string): boolean {
  if (
    !/\b(dependent\s*care\s*fsa|dcfsa|child\s*care\s*fsa|dependent\s*care)\b/i.test(
      message
    )
  ) {
    return false;
  }
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

function inferBonusFromMessage(
  message: string
): HouseholdAutoSaveIncomePatch | null {
  if (!/\bbonus\b/i.test(message)) return null;

  const pctBonusOnBase = message.match(
    /\b(\d+(?:\.\d+)?)\s*%\s*bonus(?:\s+on\s+(?:base\s+)?(?:salary|wages|income))?/i
  );
  if (pctBonusOnBase) {
    return {
      type: "bonus",
      amountMode: "percent_of_wages",
      percent: Number.parseFloat(pctBonusOnBase[1]!),
      period: "annual",
      updateMode: "set",
    };
  }

  const getPctBonus = message.match(
    /\b(?:gets?|get|receives?|receive|earns?|earn|has|have)\s+(\d+(?:\.\d+)?)\s*%\s*bonus\b/i
  );
  if (getPctBonus) {
    return {
      type: "bonus",
      amountMode: "percent_of_wages",
      percent: Number.parseFloat(getPctBonus[1]!),
      period: "annual",
      updateMode: "set",
    };
  }

  const pctMatch = message.match(
    /\b(\d+(?:\.\d+)?)\s*%\s*(?:of\s+)?(?:base\s+)?(?:salary|wages|income)\b/i
  );
  if (pctMatch) {
    return {
      type: "bonus",
      amountMode: "percent_of_wages",
      percent: Number.parseFloat(pctMatch[1]!),
      period: "annual",
      updateMode: "set",
    };
  }
  const pctBonusMatch = message.match(
    /\bbonus\s+(?:is\s+)?(\d+(?:\.\d+)?)\s*%/i
  );
  if (pctBonusMatch) {
    return {
      type: "bonus",
      amountMode: "percent_of_wages",
      percent: Number.parseFloat(pctBonusMatch[1]!),
      period: "annual",
      updateMode: "set",
    };
  }

  const fixedPatterns = [
    /\bbonus\s+(?:is|was|of|=)\s+\$?\s*([\d,]+(?:\.\d+)?)\s*(k|K|m|M)?\b/i,
    /\bbonus\s+\$?\s*([\d,]+(?:\.\d+)?)\s*(k|K|m|M)?\b/i,
    /\$?\s*([\d,]+(?:\.\d+)?)\s*(k|K|m|M)?\s+in\s+bonus\b/i,
    /\b(?:make|makes|earn|earns|get|gets|receive|receives|has|have)\s+\$?\s*([\d,]+(?:\.\d+)?)\s*(k|K|m|M)?\s+(?:in\s+)?bonus\b/i,
  ];
  for (const pattern of fixedPatterns) {
    const fixedMatch = message.match(pattern);
    if (!fixedMatch) continue;
    const amount = parseMoneyAmount(fixedMatch[1]!, fixedMatch[2]);
    if (amount != null) {
      return {
        type: "bonus",
        amountMode: "fixed",
        amount,
        period: "annual",
        updateMode: "set",
      };
    }
  }
  return null;
}

function inferCashIncomeFromMessage(
  message: string
): HouseholdAutoSaveIncomePatch | null {
  if (!/\bcash\s+income\b/i.test(message)) return null;
  const match = message.match(/\$\s*([\d,]+(?:\.\d+)?)\s*(k|K|m|M)?/i);
  if (!match) return null;
  const amount = parseMoneyAmount(match[1]!, match[2]);
  if (amount == null) return null;
  return { type: "cash_income", amount, period: "annual", updateMode: "set" };
}

function inferEmployerMatchFromMessage(
  message: string
): HouseholdAutoSaveContributionPatch | null {
  if (!/\b(employer\s+match|company\s+match|401\s*\(?k\s+match)\b/i.test(message)) {
    return null;
  }
  const baseBonusMatch = message.match(
    /\b(\d+(?:\.\d+)?)\s*%\s*(?:match|employer\s+match).*(?:salary\s+and\s+bonus|base\s*\+\s*bonus|base\s+and\s+bonus)/i
  );
  if (baseBonusMatch) {
    return {
      type: "employer_match",
      amountMode: "percent_of_wages_and_bonus",
      percent: Number.parseFloat(baseBonusMatch[1]!),
      amountExpression: "explicit",
      updateMode: "set",
    };
  }
  const pctMatch = message.match(
    /\b(\d+(?:\.\d+)?)\s*%\s*(?:employer\s+match|company\s+match|match(?:es)?\s+(?:of|on)\s+(?:salary|wages|base))/i
  );
  if (pctMatch) {
    return {
      type: "employer_match",
      amountMode: "percent_of_wages",
      percent: Number.parseFloat(pctMatch[1]!),
      amountExpression: "explicit",
      updateMode: "set",
    };
  }
  const fixedMatch = message.match(
    /\b(?:employer\s+match|company\s+match)\s+\$?\s*([\d,]+(?:\.\d+)?)\s*(k|K|m|M)?/i
  );
  if (fixedMatch) {
    const amount = parseMoneyAmount(fixedMatch[1]!, fixedMatch[2]);
    if (amount != null) {
      return {
        type: "employer_match",
        amountMode: "fixed",
        amount,
        amountExpression: "explicit",
        updateMode: "set",
      };
    }
  }
  return null;
}

function inferAddDependentFromMessage(
  message: string
): HouseholdAutoSaveMemberPatch | null {
  const match = message.match(
    /\b(?:add|new)\s+(?:kid|child|dependent|son|daughter)\s+([A-Z][a-z]+)/i
  );
  if (!match) return null;
  const name = match[1]!;
  return {
    matchName: name,
    name,
    relationship: "dependent",
  };
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
  if (mentionsMax401k(message) || mentionsMaxHsa(message) || mentionsMaxDcfsa(message)) {
    return null;
  }

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
  const addDependent = inferAddDependentFromMessage(message);
  if (addDependent) return [addDependent];

  const incomeTargets = incomeTargetsForMessage(message, members);
  const contributionTargets = contributionTargetsForMessage(message, members);
  const bonus = inferBonusFromMessage(message);
  const cashIncome = inferCashIncomeFromMessage(message);

  if (
    incomeTargets.length === 0 &&
    contributionTargets.length === 0 &&
    !bonus &&
    !cashIncome
  ) {
    return [];
  }

  const byMemberId = new Map<string, HouseholdAutoSaveMemberPatch>();
  const income = inferIncomeFromMessage(message);
  const explicitContribution = inferExplicitContributionFromMessage(message);
  const employerMatch = inferEmployerMatchFromMessage(message);

  const allTargets = new Map<string, Member>();
  const targetMembers =
    incomeTargets.length > 0
      ? incomeTargets
      : bonus || cashIncome
        ? incomeTargetsForMessage(message, members)
        : [];
  for (const m of [...targetMembers, ...contributionTargets]) {
    allTargets.set(m.id, m);
  }

  for (const member of allTargets.values()) {
    const isDependent = member.relationship === "dependent";
    let patch: HouseholdAutoSaveMemberPatch = {
      matchName: member.name,
      relationship: member.relationship,
    };

    if (!isDependent && mentionsMax401k(message)) {
      patch = mergeMemberPatch(patch, {
        matchName: member.name,
        contributions: [
          { type: "401k", amountExpression: "max", updateMode: "set" },
        ],
      });
    }

    if (!isDependent && mentionsMaxHsa(message) && contributionTargets.includes(member)) {
      patch = mergeMemberPatch(patch, {
        matchName: member.name,
        contributions: [
          { type: "hsa", amountExpression: "max", updateMode: "set" },
        ],
      });
    }

    if (!isDependent && mentionsMaxDcfsa(message) && contributionTargets.includes(member)) {
      patch = mergeMemberPatch(patch, {
        matchName: member.name,
        contributions: [
          {
            type: "fsa_dependent_care",
            amountExpression: "max",
            updateMode: "set",
          },
        ],
      });
    }

    if (income && incomeTargets.includes(member)) {
      patch = mergeMemberPatch(patch, {
        matchName: member.name,
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

    if (bonus && (incomeTargets.includes(member) || targetMembers.includes(member))) {
      patch = mergeMemberPatch(patch, {
        matchName: member.name,
        incomeSources: [bonus],
      });
    }

    if (cashIncome && (incomeTargets.includes(member) || targetMembers.includes(member))) {
      patch = mergeMemberPatch(patch, {
        matchName: member.name,
        incomeSources: [cashIncome],
      });
    }

    if (explicitContribution && !isDependent && contributionTargets.includes(member)) {
      patch = mergeMemberPatch(patch, {
        matchName: member.name,
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

    if (employerMatch && !isDependent && contributionTargets.includes(member)) {
      patch = mergeMemberPatch(patch, {
        matchName: member.name,
        contributions: [employerMatch],
      });
    }

    if (
      (patch.incomeSources?.length ?? 0) > 0 ||
      (patch.contributions?.length ?? 0) > 0 ||
      patch.relationship === "dependent"
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
    const existingIncomeTypes = new Set(
      (current.incomeSources ?? []).map((i) => i.type)
    );
    const missingIncome = (inferredPatch.incomeSources ?? []).filter(
      (i) => !existingIncomeTypes.has(i.type)
    );
    if (missingContribs.length === 0 && missingIncome.length === 0) continue;

    merged[existingIdx] = {
      ...current,
      contributions: [...(current.contributions ?? []), ...missingContribs],
      incomeSources: [...(current.incomeSources ?? []), ...missingIncome],
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

function toLimitContext(ctx: ResolveContributionContext): LimitContext {
  return {
    filingStatus: ctx.filingStatus,
    dependentCount: ctx.dependentCount,
    rules: ctx.rules,
  };
}

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
  const limitCtx = toLimitContext(ctx);

  if (isHouseholdScopedType(type, limitCtx)) {
    const cap = statutoryLimit(type, limitCtx);
    if (expression === "max") return cap;
    if (expression === "half_max") return Math.round(cap / 2);
    return Math.max(0, explicitAmount ?? 0);
  }

  let limit: number;
  if (type === "hsa") {
    limit = statutoryLimit(type, limitCtx);
  } else if (RETIREMENT_TYPES.includes(type)) {
    limit = statutoryLimit("401k", limitCtx);
  } else if (type === "fsa_health") {
    limit = statutoryLimit("fsa_health", limitCtx);
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
  const lineData: IncomeLineItem = {
    id: idx >= 0 ? existing[idx]!.id : newLineId(),
    type: patch.type,
    amount:
      patch.type === "bonus" && patch.amountMode === "percent_of_wages"
        ? 0
        : Math.max(0, amount),
    ...(patch.amountMode ? { amountMode: patch.amountMode } : {}),
    ...(patch.percent != null ? { percent: patch.percent } : {}),
  };
  if (idx === -1) return [...existing, lineData];
  const line = existing[idx]!;
  if (patch.type === "bonus" && patch.amountMode === "percent_of_wages") {
    return existing.map((l, i) =>
      i === idx
        ? {
            ...l,
            amount: 0,
            amountMode: patch.amountMode,
            percent: patch.percent,
          }
        : l
    );
  }
  const nextAmount =
    patch.updateMode === "add"
      ? Math.max(0, line.amount + amount)
      : Math.max(0, amount);
  return existing.map((l, i) =>
    i === idx ? { ...lineData, amount: nextAmount } : l
  );
}

function upsertContributionLine(
  existing: ContributionLineItem[],
  patch: HouseholdAutoSaveContributionPatch,
  member: Member,
  ctx: ResolveContributionContext
): ContributionLineItem[] {
  let amount: number;
  if (patch.type === "employer_match" && patch.amountMode && patch.amountMode !== "fixed") {
    const draft: ContributionLineItem = {
      id: newLineId(),
      type: "employer_match",
      amount: 0,
      amountMode: patch.amountMode,
      percent: patch.percent,
    };
    amount = resolveMemberContributionAmount(member, draft);
  } else {
    amount = resolveContributionAmount(
      patch.type,
      patch.amountExpression,
      patch.amount,
      ctx
    );
  }

  const idx = existing.findIndex((line) => line.type === patch.type);
  const lineData: ContributionLineItem = {
    id: idx >= 0 ? existing[idx]!.id : newLineId(),
    type: patch.type,
    amount: Math.max(0, amount),
    ...(patch.amountMode ? { amountMode: patch.amountMode } : {}),
    ...(patch.percent != null ? { percent: patch.percent } : {}),
  };

  if (idx === -1) return [...existing, lineData];

  const line = existing[idx]!;
  const nextAmount =
    patch.updateMode === "add"
      ? Math.max(0, line.amount + amount)
      : Math.max(0, amount);
  return existing.map((l, i) =>
    i === idx ? { ...lineData, amount: nextAmount } : l
  );
}

function applyHouseholdContributionAllocations(
  members: Member[],
  patches: HouseholdAutoSaveMemberPatch[],
  ctx: ResolveContributionContext
): Member[] {
  const limitCtx = toLimitContext(ctx);
  const scopedTypes = householdScopedContributionTypes(limitCtx);
  let result = members;

  for (const type of scopedTypes) {
    const targets: Array<{
      memberId: string;
      expression: "max" | "half_max" | "explicit";
      explicitAmount?: number;
    }> = [];

    for (const patch of patches) {
      const idx = findMemberIndex(result, patch);
      if (idx < 0) continue;
      const member = result[idx]!;
      for (const contrib of patch.contributions ?? []) {
        if (contrib.type !== type) continue;
        targets.push({
          memberId: member.id,
          expression: contrib.amountExpression,
          explicitAmount: contrib.amount,
        });
      }
    }

    if (targets.length === 0) continue;

    const allocated = allocateHouseholdLimit({
      type,
      targets,
      existingMembers: result,
      ctx: limitCtx,
      strategy: "split_even",
    });

    result = result.map((member) => {
      const amount = allocated.get(member.id);
      if (amount == null) return member;
      const lines = [...(member.contributions ?? [])];
      const idx = lines.findIndex((l) => l.type === type);
      if (idx === -1) {
        lines.push({ id: newLineId(), type, amount });
      } else {
        lines[idx] = { ...lines[idx]!, amount };
      }
      return { ...member, contributions: lines };
    });
  }

  return result;
}

function reResolveEmployerMatch(members: Member[]): Member[] {
  return members.map((member) => ({
    ...member,
    contributions: (member.contributions ?? []).map((line) => {
      if (line.type !== "employer_match") return line;
      return {
        ...line,
        amount: resolveMemberContributionAmount(member, line),
      };
    }),
  }));
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

  const memberDraft: Member = {
    id: newLineId(),
    householdId,
    name: (patch.name ?? patch.matchName).trim(),
    relationship: patch.relationship ?? "other",
    isActive: true,
    incomeSources,
    contributions: [],
    createdAt: now,
    updatedAt: now,
  };

  for (const contrib of patch.contributions ?? []) {
    const limitCtx = toLimitContext(ctx);
    if (isHouseholdScopedType(contrib.type, limitCtx)) continue;
    contributions = upsertContributionLine(
      contributions,
      contrib,
      memberDraft,
      ctx
    );
  }

  return { ...memberDraft, contributions };
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
    const limitCtx = toLimitContext(options.contributionContext);
    for (const contrib of patch.contributions ?? []) {
      if (isHouseholdScopedType(contrib.type, limitCtx)) continue;
      const memberWithIncome = { ...updated, incomeSources };
      contributions = upsertContributionLine(
        contributions,
        contrib,
        memberWithIncome,
        options.contributionContext
      );
    }

    members[idx] = { ...updated, incomeSources, contributions };
  }

  members = applyHouseholdContributionAllocations(
    members,
    patches,
    options.contributionContext
  );

  members = normalizeHouseholdContributions(
    members,
    toLimitContext(options.contributionContext)
  );

  members = reResolveEmployerMatch(members);

  return members;
}

export function inferLiquidCashFromMessage(message: string): number | null {
  if (!/\b(liquid\s+cash|cash\s+on\s+hand|cash\s+balance|in\s+cash)\b/i.test(message)) {
    return null;
  }
  const match = message.match(/\$\s*([\d,]+(?:\.\d+)?)\s*(k|K|m|M)?/i);
  if (!match) return null;
  return parseMoneyAmount(match[1]!, match[2]);
}

/** Exported for tests — resolve annual wages including bonus for a member. */
export function resolvedWagesForMember(member: Member): number {
  const { wages, bonus } = resolveMemberIncomeAmounts(member);
  return wages + bonus;
}
