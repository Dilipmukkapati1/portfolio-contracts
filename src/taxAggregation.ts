import type { ContributionType, FilingStatus, IncomeSourceType } from "./enums.js";
import type { Household } from "./dtos/household.js";
import { normalizeHousehold, resolvePrimaryState } from "./dtos/household.js";
import type { Member } from "./dtos/member.js";
import type { ContributionLimitStatus, TaxProfile } from "./dtos/taxProfile.js";
import { taxProfileDocumentId } from "./dtos/taxProfile.js";
import type { TaxYearInput } from "./dtos/tax.js";
import {
  hsaCoverage,
  statutoryLimit,
  sumHouseholdContributions,
  type LimitContext,
} from "./contributionLimits.js";
import { resolveMemberIncomeAmounts } from "./memberIncome.js";

export interface TaxRuleLimits {
  retirement401kLimit?: number;
  hsaFamilyLimit?: number;
  hsaSingleLimit?: number;
  fsaHealthLimit?: number;
  fsaDependentCareLimit?: number;
  fsaDependentCareLimitMfs?: number;
}

const RETIREMENT_CONTRIBUTION_TYPES: ContributionType[] = [
  "401k",
  "403b",
  "traditional_ira",
  "sep_ira",
  "solo_401k",
  "simple_ira",
];

const HSA_CONTRIBUTION_TYPES: ContributionType[] = ["hsa"];
const DCFSA_CONTRIBUTION_TYPES: ContributionType[] = ["fsa_dependent_care"];

const INCOME_TO_TAX_FIELD: Record<
  IncomeSourceType,
  keyof Pick<
    TaxYearInput,
    | "wages"
    | "selfEmploymentIncome"
    | "interestIncome"
    | "dividendIncome"
    | "capitalGainsShort"
    | "capitalGainsLong"
    | "otherIncome"
  > | null
> = {
  wages: "wages",
  bonus: "wages",
  cash_income: "otherIncome",
  self_employment: "selfEmploymentIncome",
  interest: "interestIncome",
  dividends: "dividendIncome",
  capital_gains_short: "capitalGainsShort",
  capital_gains_long: "capitalGainsLong",
  other: "otherIncome",
};

function limitContext(
  filingStatus: FilingStatus,
  dependentCount: number,
  rules: TaxRuleLimits
): LimitContext {
  return { filingStatus, dependentCount, rules };
}

export function sumMemberIncome(members: Member[]): Partial<TaxYearInput> {
  const totals: Partial<TaxYearInput> = {};
  for (const member of members) {
    if (!member.isActive) continue;
    const resolved = resolveMemberIncomeAmounts(member);
    const wagesTotal = resolved.wages + resolved.bonus;
    if (wagesTotal > 0) {
      totals.wages = (totals.wages ?? 0) + wagesTotal;
    }
    if (resolved.cashIncome > 0) {
      totals.otherIncome = (totals.otherIncome ?? 0) + resolved.cashIncome;
    }
    for (const line of member.incomeSources) {
      if (line.type === "wages" || line.type === "bonus" || line.type === "cash_income") {
        continue;
      }
      const field = INCOME_TO_TAX_FIELD[line.type];
      if (!field) continue;
      const current = (totals[field] as number | undefined) ?? 0;
      (totals as Record<string, number>)[field] = current + line.amount;
    }
  }
  return totals;
}

export function sumMemberContributions(members: Member[]): {
  retirementContributions: number;
  hsaContributions: number;
} {
  let retirementContributions = 0;
  let hsaContributions = 0;
  for (const member of members) {
    if (!member.isActive) continue;
    for (const line of member.contributions) {
      if (RETIREMENT_CONTRIBUTION_TYPES.includes(line.type)) {
        retirementContributions += line.amount;
      }
      if (HSA_CONTRIBUTION_TYPES.includes(line.type)) {
        hsaContributions += line.amount;
      }
    }
  }
  return { retirementContributions, hsaContributions };
}

/** Pre-tax deferrals deductible on the return, capped per plan limits. */
export function sumDeductibleMemberContributions(
  members: Member[],
  rules: TaxRuleLimits = {},
  filingStatus: FilingStatus = "single",
  dependentCount = 0
): {
  retirementContributions: number;
  hsaContributions: number;
} {
  const ctx = limitContext(filingStatus, dependentCount, rules);
  const retirementLimit = statutoryLimit("401k", ctx);

  let retirementContributions = 0;
  for (const member of members) {
    if (!member.isActive) continue;
    let retirement = 0;
    for (const line of member.contributions) {
      if (RETIREMENT_CONTRIBUTION_TYPES.includes(line.type)) {
        retirement += line.amount;
      }
    }
    retirementContributions += Math.min(retirement, retirementLimit);
  }

  const hsaTotal = sumHouseholdContributions(members, "hsa");
  const hsaLimit = statutoryLimit("hsa", ctx);
  const hsaContributions = Math.min(hsaTotal, hsaLimit);

  return { retirementContributions, hsaContributions };
}

export function sumDeductibleDcfsaContributions(
  members: Member[],
  rules: TaxRuleLimits = {},
  filingStatus: FilingStatus = "single",
  dependentCount = 0
): number {
  const ctx = limitContext(filingStatus, dependentCount, rules);
  const total = sumHouseholdContributions(members, "fsa_dependent_care");
  return Math.min(total, statutoryLimit("fsa_dependent_care", ctx));
}

export function prepareTaxInputForEstimate(input: TaxYearInput): TaxYearInput {
  const deferrals = input.retirementContributions + input.hsaContributions;
  if (deferrals <= 0) {
    return input;
  }
  return {
    ...input,
    adjustments: input.adjustments + deferrals,
    retirementContributions: 0,
    hsaContributions: 0,
  };
}

export function countDependents(members: Member[]): number {
  return members.filter((m) => m.isActive && m.relationship === "dependent").length;
}

export function computeContributionLimits(
  members: Member[],
  filingStatus: FilingStatus,
  dependentCount: number,
  rules: TaxRuleLimits
): ContributionLimitStatus[] {
  const limits: ContributionLimitStatus[] = [];
  const ctx = limitContext(filingStatus, dependentCount, rules);
  const retirementLimit = statutoryLimit("401k", ctx);

  for (const member of members) {
    if (!member.isActive) continue;
    let retirementContributed = 0;
    for (const line of member.contributions) {
      if (RETIREMENT_CONTRIBUTION_TYPES.includes(line.type)) {
        retirementContributed += line.amount;
      }
    }
    if (retirementContributed > 0) {
      limits.push({
        type: "401k",
        memberId: member.id,
        scope: "per_member",
        limit: retirementLimit,
        contributed: retirementContributed,
        remaining: Math.max(0, retirementLimit - retirementContributed),
      });
    }

    const healthFsa = (member.contributions ?? [])
      .filter((l) => l.type === "fsa_health")
      .reduce((s, l) => s + l.amount, 0);
    if (healthFsa > 0) {
      const healthLimit = statutoryLimit("fsa_health", ctx);
      limits.push({
        type: "fsa_health",
        memberId: member.id,
        scope: "per_member",
        limit: healthLimit,
        contributed: healthFsa,
        remaining: Math.max(0, healthLimit - healthFsa),
      });
    }
  }

  const coverage = hsaCoverage(ctx);
  const hsaTotal = sumHouseholdContributions(members, "hsa");
  if (hsaTotal > 0 || coverage === "family") {
    const hsaLimit = statutoryLimit("hsa", ctx);
    if (coverage === "family") {
      if (hsaTotal > 0) {
        limits.push({
          type: "hsa",
          scope: "household",
          limit: hsaLimit,
          contributed: hsaTotal,
          remaining: Math.max(0, hsaLimit - hsaTotal),
        });
      }
    } else {
      for (const member of members) {
        if (!member.isActive) continue;
        const hsaContributed = (member.contributions ?? [])
          .filter((l) => l.type === "hsa")
          .reduce((s, l) => s + l.amount, 0);
        if (hsaContributed > 0) {
          limits.push({
            type: "hsa",
            memberId: member.id,
            scope: "per_member",
            limit: hsaLimit,
            contributed: hsaContributed,
            remaining: Math.max(0, hsaLimit - hsaContributed),
          });
        }
      }
    }
  }

  const dcfsaTotal = sumHouseholdContributions(members, "fsa_dependent_care");
  if (dcfsaTotal > 0) {
    const dcfsaLimit = statutoryLimit("fsa_dependent_care", ctx);
    limits.push({
      type: "fsa_dependent_care",
      scope: "household",
      limit: dcfsaLimit,
      contributed: dcfsaTotal,
      remaining: Math.max(0, dcfsaLimit - dcfsaTotal),
    });
  }

  return limits;
}

export interface BuildTaxProfileOptions {
  taxYear: number;
  filingStatus?: FilingStatus;
  inputOverrides?: Partial<TaxYearInput>;
  rules?: TaxRuleLimits;
  existing?: TaxProfile | null;
}

export function buildTaxProfileFromMembers(
  household: Household,
  members: Member[],
  options: BuildTaxProfileOptions
): TaxProfile {
  const normalized = normalizeHousehold(household);
  const { taxYear, rules = {}, existing } = options;
  const activeMembers = members.filter((m) => m.isActive);
  const dependentCount = countDependents(members);
  const incomeTotals = sumMemberIncome(members);

  const filingStatus =
    options.filingStatus ??
    existing?.filingStatus ??
    household.filingStatus ??
    "single";

  const contributionTotals = sumDeductibleMemberContributions(
    members,
    rules,
    filingStatus,
    dependentCount
  );

  const inputs: TaxYearInput = {
    taxYear,
    filingStatus,
    wages: incomeTotals.wages ?? 0,
    selfEmploymentIncome: incomeTotals.selfEmploymentIncome ?? 0,
    interestIncome: incomeTotals.interestIncome ?? 0,
    dividendIncome: incomeTotals.dividendIncome ?? 0,
    capitalGainsShort: incomeTotals.capitalGainsShort ?? 0,
    capitalGainsLong: incomeTotals.capitalGainsLong ?? 0,
    otherIncome: incomeTotals.otherIncome ?? 0,
    adjustments: 0,
    dependents: dependentCount,
    retirementContributions: contributionTotals.retirementContributions,
    hsaContributions: contributionTotals.hsaContributions,
    ...options.inputOverrides,
  };

  const now = new Date().toISOString();
  const id = taxProfileDocumentId(normalized.householdId, taxYear);

  return {
    id,
    householdId: normalized.householdId,
    taxYear,
    filingStatus,
    dependentCount,
    memberIds: activeMembers.map((m) => m.id),
    inputs,
    fieldProvenance: {
      wages: "member_aggregate",
      selfEmploymentIncome: "member_aggregate",
      interestIncome: "member_aggregate",
      dividendIncome: "member_aggregate",
      capitalGainsShort: "member_aggregate",
      capitalGainsLong: "member_aggregate",
      otherIncome: "member_aggregate",
      retirementContributions: "member_aggregate",
      hsaContributions: "member_aggregate",
      dependents: "member_aggregate",
      filingStatus: existing?.fieldProvenance?.filingStatus ?? "manual",
    },
    contributionLimits: computeContributionLimits(
      members,
      filingStatus,
      dependentCount,
      rules
    ),
    withholding: existing?.withholding,
    estimatedPayments: existing?.estimatedPayments,
    lastEstimate: existing?.lastEstimate,
    lastEstimatedAt: existing?.lastEstimatedAt,
    strategyChecklist: existing?.strategyChecklist,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

export function defaultTaxYear(household: Household): number {
  return household.settings?.defaultTaxYear ?? new Date().getFullYear();
}

export function legacyTaxProfileFromHousehold(
  household: Household,
  taxYear: number
): TaxProfile | null {
  if (!household.filingStatus && household.dependents === undefined) {
    return null;
  }
  const normalized = normalizeHousehold(household);
  const now = new Date().toISOString();
  const filingStatus = household.filingStatus ?? "single";
  const dependentCount = household.dependents ?? 0;
  return {
    id: taxProfileDocumentId(normalized.householdId, taxYear),
    householdId: normalized.householdId,
    taxYear,
    filingStatus,
    dependentCount,
    memberIds: [],
    inputs: {
      taxYear,
      filingStatus,
      wages: 0,
      selfEmploymentIncome: 0,
      interestIncome: 0,
      dividendIncome: 0,
      capitalGainsShort: 0,
      capitalGainsLong: 0,
      otherIncome: 0,
      adjustments: 0,
      dependents: dependentCount,
      retirementContributions: 0,
      hsaContributions: 0,
    },
    fieldProvenance: { filingStatus: "manual", dependents: "manual" },
    createdAt: now,
    updatedAt: now,
  };
}

export { resolvePrimaryState };
