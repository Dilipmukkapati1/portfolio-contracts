import type { ContributionType, FilingStatus } from "./enums.js";
import type { Member } from "./dtos/member.js";
import type { TaxRuleLimits } from "./taxAggregation.js";

export type ContributionLimitScope = "per_member" | "household";

export type HsaCoverage = "single" | "family";

export interface LimitContext {
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

const HOUSEHOLD_SCOPED_TYPES: ContributionType[] = ["fsa_dependent_care"];

export function hsaCoverage(ctx: {
  filingStatus: FilingStatus;
  dependentCount: number;
}): HsaCoverage {
  if (
    ctx.filingStatus === "married_filing_jointly" ||
    ctx.dependentCount > 0
  ) {
    return "family";
  }
  return "single";
}

export function isHouseholdScopedType(
  type: ContributionType,
  ctx: LimitContext
): boolean {
  if (type === "fsa_dependent_care") return true;
  if (type === "hsa") return hsaCoverage(ctx) === "family";
  return false;
}

export function contributionLimitScope(
  type: ContributionType,
  ctx: LimitContext
): ContributionLimitScope {
  return isHouseholdScopedType(type, ctx) ? "household" : "per_member";
}

export function statutoryLimit(
  type: ContributionType,
  ctx: LimitContext
): number {
  const rules = ctx.rules;
  if (type === "hsa") {
    return hsaCoverage(ctx) === "family"
      ? (rules.hsaFamilyLimit ?? 8550)
      : (rules.hsaSingleLimit ?? 4300);
  }
  if (type === "fsa_dependent_care") {
    return ctx.filingStatus === "married_filing_separately"
      ? (rules.fsaDependentCareLimitMfs ?? 2500)
      : (rules.fsaDependentCareLimit ?? 5000);
  }
  if (type === "fsa_health") {
    return rules.fsaHealthLimit ?? 3300;
  }
  if (RETIREMENT_TYPES.includes(type)) {
    return rules.retirement401kLimit ?? 23500;
  }
  return 0;
}

export function memberContributionTotal(
  member: Member,
  type: ContributionType
): number {
  if (!member.isActive) return 0;
  return (member.contributions ?? [])
    .filter((line) => line.type === type)
    .reduce((sum, line) => sum + line.amount, 0);
}

export function sumHouseholdContributions(
  members: Member[],
  type: ContributionType
): number {
  let total = 0;
  for (const member of members) {
    if (!member.isActive) continue;
    total += memberContributionTotal(member, type);
  }
  return total;
}

export type HouseholdAllocationExpression = "max" | "half_max" | "explicit";

export interface HouseholdAllocationTarget {
  memberId: string;
  expression: HouseholdAllocationExpression;
  explicitAmount?: number;
  updateMode?: "set" | "add";
}

export function allocateHouseholdLimit(options: {
  type: ContributionType;
  targets: HouseholdAllocationTarget[];
  existingMembers: Member[];
  excludedMemberIds?: Set<string>;
  ctx: LimitContext;
  strategy: "split_even";
}): Map<string, number> {
  const { type, targets, existingMembers, ctx } = options;
  const excluded = options.excludedMemberIds ?? new Set<string>();
  const cap = statutoryLimit(type, ctx);
  const effectiveCap =
    options.targets.some((t) => t.expression === "half_max")
      ? Math.round(cap / 2)
      : cap;

  let room = effectiveCap;
  for (const member of existingMembers) {
    if (!member.isActive || excluded.has(member.id)) continue;
    if (targets.some((t) => t.memberId === member.id)) continue;
    room -= memberContributionTotal(member, type);
  }
  room = Math.max(0, room);

  const result = new Map<string, number>();
  if (targets.length === 0) return result;

  const hasExplicitOnly = targets.every((t) => t.expression === "explicit");
  if (hasExplicitOnly) {
    let explicitTotal = 0;
    for (const target of targets) {
      const amt = Math.max(0, target.explicitAmount ?? 0);
      explicitTotal += amt;
      result.set(target.memberId, amt);
    }
    if (explicitTotal <= room) return result;
    const scale = room / explicitTotal;
    for (const target of targets) {
      result.set(
        target.memberId,
        Math.floor((target.explicitAmount ?? 0) * scale)
      );
    }
    let assigned = [...result.values()].reduce((a, b) => a + b, 0);
    const remainder = room - assigned;
    if (remainder > 0 && targets.length > 0) {
      const lastId = targets[targets.length - 1]!.memberId;
      result.set(lastId, (result.get(lastId) ?? 0) + remainder);
    }
    return result;
  }

  const perTarget = Math.floor(room / targets.length);
  let remainder = room - perTarget * targets.length;
  for (let i = 0; i < targets.length; i++) {
    const target = targets[i]!;
    let amount = perTarget;
    if (i === targets.length - 1) {
      amount += remainder;
    }
    result.set(target.memberId, amount);
  }
  return result;
}

export function normalizeHouseholdContributions(
  members: Member[],
  ctx: LimitContext
): Member[] {
  const householdTypes = new Set<ContributionType>();
  if (hsaCoverage(ctx) === "family") householdTypes.add("hsa");
  householdTypes.add("fsa_dependent_care");

  let updated = members.map((m) => ({
    ...m,
    contributions: [...(m.contributions ?? [])],
  }));

  for (const type of householdTypes) {
    const cap = statutoryLimit(type, ctx);
    const total = sumHouseholdContributions(updated, type);
    if (total <= cap) continue;

    const scale = cap / total;
    updated = updated.map((member) => {
      if (!member.isActive) return member;
      const lines = member.contributions ?? [];
      const hasType = lines.some((l) => l.type === type);
      if (!hasType) return member;
      return {
        ...member,
        contributions: lines.map((line) =>
          line.type === type
            ? { ...line, amount: Math.floor(line.amount * scale) }
            : line
        ),
      };
    });

    let assigned = sumHouseholdContributions(updated, type);
    const diff = cap - assigned;
    if (diff > 0) {
      for (const member of updated) {
        if (!member.isActive) continue;
        const line = member.contributions?.find((l) => l.type === type);
        if (line && line.amount > 0) {
          line.amount += diff;
          break;
        }
      }
    }
  }

  return updated;
}

export function householdScopedContributionTypes(ctx: LimitContext): ContributionType[] {
  const types: ContributionType[] = ["fsa_dependent_care"];
  if (hsaCoverage(ctx) === "family") types.push("hsa");
  return types;
}
