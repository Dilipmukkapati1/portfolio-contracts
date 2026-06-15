import type { ContributionType, FilingStatus, IncomeSourceType } from "./enums.js";
import type { Household } from "./dtos/household.js";
import { normalizeHousehold, resolvePrimaryState } from "./dtos/household.js";
import type { Member } from "./dtos/member.js";
import type { ContributionLimitStatus, TaxProfile } from "./dtos/taxProfile.js";
import { taxProfileDocumentId } from "./dtos/taxProfile.js";
import type { TaxYearInput } from "./dtos/tax.js";

export interface TaxRuleLimits {
  retirement401kLimit?: number;
  hsaFamilyLimit?: number;
  hsaSingleLimit?: number;
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
  >
> = {
  wages: "wages",
  self_employment: "selfEmploymentIncome",
  interest: "interestIncome",
  dividends: "dividendIncome",
  capital_gains_short: "capitalGainsShort",
  capital_gains_long: "capitalGainsLong",
  other: "otherIncome",
};

export function sumMemberIncome(members: Member[]): Partial<TaxYearInput> {
  const totals: Partial<TaxYearInput> = {};
  for (const member of members) {
    if (!member.isActive) continue;
    for (const line of member.incomeSources) {
      const field = INCOME_TO_TAX_FIELD[line.type];
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

/** Pre-tax deferrals deductible on the return, capped per member at plan limits. */
export function sumDeductibleMemberContributions(
  members: Member[],
  rules: TaxRuleLimits = {}
): {
  retirementContributions: number;
  hsaContributions: number;
} {
  const retirementLimit = rules.retirement401kLimit ?? 23500;
  const hsaLimitPerMember = rules.hsaSingleLimit ?? 4300;
  const hsaFamilyLimit = rules.hsaFamilyLimit ?? 8550;

  let retirementContributions = 0;
  let hsaContributions = 0;
  let activeMemberCount = 0;

  for (const member of members) {
    if (!member.isActive) continue;
    activeMemberCount += 1;
    let retirement = 0;
    let hsa = 0;
    for (const line of member.contributions) {
      if (RETIREMENT_CONTRIBUTION_TYPES.includes(line.type)) {
        retirement += line.amount;
      }
      if (line.type === "hsa") {
        hsa += line.amount;
      }
    }
    retirementContributions += Math.min(retirement, retirementLimit);
    hsaContributions += Math.min(hsa, hsaLimitPerMember);
  }

  if (activeMemberCount > 1) {
    hsaContributions = Math.min(hsaContributions, hsaFamilyLimit);
  }

  return { retirementContributions, hsaContributions };
}

/**
 * Normalize tax inputs before calling the estimator so pre-tax deferrals
 * always reduce AGI (works with tax-engine builds that only read `adjustments`).
 */
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
  const retirementLimit = rules.retirement401kLimit ?? 23500;
  const hsaLimit =
    dependentCount > 0 || filingStatus === "married_filing_jointly"
      ? (rules.hsaFamilyLimit ?? 8550)
      : (rules.hsaSingleLimit ?? 4300);

  for (const member of members) {
    if (!member.isActive) continue;
    let retirementContributed = 0;
    let hsaContributed = 0;
    for (const line of member.contributions) {
      if (RETIREMENT_CONTRIBUTION_TYPES.includes(line.type)) {
        retirementContributed += line.amount;
      }
      if (line.type === "hsa") {
        hsaContributed += line.amount;
      }
    }
    if (retirementContributed > 0) {
      limits.push({
        type: "401k",
        memberId: member.id,
        limit: retirementLimit,
        contributed: retirementContributed,
        remaining: Math.max(0, retirementLimit - retirementContributed),
      });
    }
    if (hsaContributed > 0) {
      limits.push({
        type: "hsa",
        memberId: member.id,
        limit: hsaLimit,
        contributed: hsaContributed,
        remaining: Math.max(0, hsaLimit - hsaContributed),
      });
    }
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
  const contributionTotals = sumDeductibleMemberContributions(members, rules);

  const filingStatus =
    options.filingStatus ??
    existing?.filingStatus ??
    household.filingStatus ??
    "single";

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
