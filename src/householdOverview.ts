import type { ContributionType } from "./enums.js";
import type { Member } from "./dtos/member.js";
import type { TaxProfile } from "./dtos/taxProfile.js";
import type { TaxYearInput } from "./dtos/tax.js";
import {
  resolveMemberContributionAmount,
  resolveMemberIncomeAmounts,
} from "./memberIncome.js";

const PRETAX_401K_TYPES: ContributionType[] = ["401k", "403b", "solo_401k"];
const PRETAX_IRA_TYPES: ContributionType[] = [
  "traditional_ira",
  "sep_ira",
  "simple_ira",
];

export type HouseholdContributionBreakdown = {
  pretax401k: number;
  afterTax401k: number;
  pretaxIra: number;
  afterTaxIra: number;
  hsa: number;
  employerMatch: number;
};

export type CarryForwardItem = {
  id: string;
  label: string;
  value: number | null;
  note?: string;
  expiresYearEnd?: boolean;
};

export type HouseholdOverviewSnapshot = {
  incomeBeforeTax: number;
  incomeAfterTax: number;
  totalTax: number;
  contributions: HouseholdContributionBreakdown;
  carryForward: CarryForwardItem[];
  taxYear?: number;
  source: "live" | "snapshot" | "aggregate";
  yearsIncluded?: number;
};

export type TaxOutlookLike = {
  totalTaxAnnual: number;
};

function sumMemberIncomeTotal(member: Member): number {
  const resolved = resolveMemberIncomeAmounts(member);
  let total = resolved.wages + resolved.bonus + resolved.cashIncome;
  for (const line of member.incomeSources ?? []) {
    if (
      line.type === "wages" ||
      line.type === "bonus" ||
      line.type === "cash_income"
    ) {
      continue;
    }
    total += line.amount;
  }
  return total;
}

function sumContributionByTypes(
  member: Member,
  types: ContributionType[]
): number {
  const typeSet = new Set(types);
  return (member.contributions ?? []).reduce((sum, line) => {
    if (!typeSet.has(line.type)) return sum;
    return sum + resolveMemberContributionAmount(member, line);
  }, 0);
}

export function resolveHouseholdContributionBreakdown(
  members: Member[]
): HouseholdContributionBreakdown {
  const active = members.filter((m) => m.isActive !== false);
  let pretax401k = 0;
  let afterTax401k = 0;
  let pretaxIra = 0;
  let afterTaxIra = 0;
  let hsa = 0;
  let employerMatch = 0;

  for (const member of active) {
    pretax401k += sumContributionByTypes(member, PRETAX_401K_TYPES);
    pretaxIra += sumContributionByTypes(member, PRETAX_IRA_TYPES);
    afterTaxIra += sumContributionByTypes(member, ["roth_ira"]);
    hsa += sumContributionByTypes(member, ["hsa"]);
    employerMatch += sumContributionByTypes(member, ["employer_match"]);
  }

  return {
    pretax401k,
    afterTax401k,
    pretaxIra,
    afterTaxIra,
    hsa,
    employerMatch,
  };
}

export function resolveHouseholdIncomeTotal(members: Member[]): number {
  return members
    .filter((m) => m.isActive !== false)
    .reduce((sum, member) => sum + sumMemberIncomeTotal(member), 0);
}

function incomeFromTaxInputs(inputs: TaxYearInput): number {
  return (
    (inputs.wages ?? 0) +
    (inputs.selfEmploymentIncome ?? 0) +
    (inputs.interestIncome ?? 0) +
    (inputs.dividendIncome ?? 0) +
    (inputs.capitalGainsShort ?? 0) +
    (inputs.capitalGainsLong ?? 0) +
    (inputs.otherIncome ?? 0)
  );
}

function estimateTotalTax(profile: TaxProfile, incomeBeforeTax: number): number {
  const estimate = profile.lastEstimate;
  if (!estimate) {
    return 0;
  }
  const federal = Number(estimate.federalTax ?? 0);
  if (federal > 0) {
    return federal;
  }
  const rate = Number(estimate.effectiveRate ?? 0);
  if (rate > 0 && incomeBeforeTax > 0) {
    return Math.round(incomeBeforeTax * rate);
  }
  return 0;
}

function contributionsFromTaxProfile(
  profile: TaxProfile
): HouseholdContributionBreakdown {
  const inputs = profile.inputs;
  const retirement = Number(inputs.retirementContributions ?? 0);
  const hsa = Number(inputs.hsaContributions ?? 0);

  return {
    pretax401k: retirement,
    afterTax401k: 0,
    pretaxIra: 0,
    afterTaxIra: 0,
    hsa,
    employerMatch: 0,
  };
}

export function buildCarryForwardItems(
  contributions: HouseholdContributionBreakdown,
  taxProfile: TaxProfile | null | undefined,
  includeYearEndRoom: boolean
): CarryForwardItem[] {
  const items: CarryForwardItem[] = [];

  if (includeYearEndRoom && taxProfile?.contributionLimits?.length) {
    for (const limit of taxProfile.contributionLimits) {
      const remaining = limit.remaining ?? 0;
      if (remaining <= 0) continue;

      if (limit.type === "401k") {
        items.push({
          id: `401k-${limit.memberId ?? "household"}`,
          label: "401(k) room left this year",
          value: remaining,
          expiresYearEnd: true,
        });
      } else if (limit.type === "hsa") {
        items.push({
          id: `hsa-${limit.memberId ?? "household"}`,
          label: "HSA room left this year",
          value: remaining,
          expiresYearEnd: true,
        });
      } else if (
        limit.type === "fsa_health" ||
        limit.type === "fsa_dependent_care"
      ) {
        items.push({
          id: `${limit.type}-${limit.memberId ?? "household"}`,
          label: "Use by Dec 31",
          value: remaining,
          expiresYearEnd: true,
        });
      }
    }
  }

  if (contributions.hsa > 0 || items.some((i) => i.id.startsWith("hsa-"))) {
    items.push({
      id: "hsa-rollover",
      label: "HSA balances roll over indefinitely",
      value: null,
      note: "Account balance not tracked in profile",
    });
  }

  if (contributions.afterTaxIra > 0) {
    items.push({
      id: "roth-ira",
      label: "Roth IRA (after-tax, grows tax-free)",
      value: contributions.afterTaxIra,
    });
  }

  return items;
}

export function buildOverviewFromMembers(
  members: Member[],
  taxProfile: TaxProfile | null | undefined,
  taxOutlook: TaxOutlookLike | null | undefined
): HouseholdOverviewSnapshot {
  const incomeBeforeTax = resolveHouseholdIncomeTotal(members);
  const contributions = resolveHouseholdContributionBreakdown(members);
  const totalTax =
    taxOutlook?.totalTaxAnnual ??
    (taxProfile ? estimateTotalTax(taxProfile, incomeBeforeTax) : 0);
  const incomeAfterTax = Math.max(0, incomeBeforeTax - totalTax);

  return {
    incomeBeforeTax,
    incomeAfterTax,
    totalTax,
    contributions,
    carryForward: buildCarryForwardItems(contributions, taxProfile, true),
    taxYear: taxProfile?.taxYear,
    source: "live",
  };
}

export function buildOverviewFromTaxProfile(
  profile: TaxProfile
): HouseholdOverviewSnapshot {
  const incomeBeforeTax = incomeFromTaxInputs(profile.inputs);
  const totalTax = estimateTotalTax(profile, incomeBeforeTax);
  const contributions = contributionsFromTaxProfile(profile);

  return {
    incomeBeforeTax,
    incomeAfterTax: Math.max(0, incomeBeforeTax - totalTax),
    totalTax,
    contributions,
    carryForward: buildCarryForwardItems(contributions, profile, false),
    taxYear: profile.taxYear,
    source: "snapshot",
  };
}

function addBreakdowns(
  a: HouseholdContributionBreakdown,
  b: HouseholdContributionBreakdown
): HouseholdContributionBreakdown {
  return {
    pretax401k: a.pretax401k + b.pretax401k,
    afterTax401k: a.afterTax401k + b.afterTax401k,
    pretaxIra: a.pretaxIra + b.pretaxIra,
    afterTaxIra: a.afterTaxIra + b.afterTaxIra,
    hsa: a.hsa + b.hsa,
    employerMatch: a.employerMatch + b.employerMatch,
  };
}

function scaleBreakdown(
  breakdown: HouseholdContributionBreakdown,
  progress: number
): HouseholdContributionBreakdown {
  const scale = (value: number) => Math.round(value * progress);
  return {
    pretax401k: scale(breakdown.pretax401k),
    afterTax401k: scale(breakdown.afterTax401k),
    pretaxIra: scale(breakdown.pretaxIra),
    afterTaxIra: scale(breakdown.afterTaxIra),
    hsa: scale(breakdown.hsa),
    employerMatch: scale(breakdown.employerMatch),
  };
}

/** Scale an annual snapshot to year-to-date progress (0–1). */
export function scaleOverviewSnapshot(
  snapshot: HouseholdOverviewSnapshot,
  progress: number
): HouseholdOverviewSnapshot {
  const p = Math.min(1, Math.max(0, progress));
  const scale = (value: number) => Math.round(value * p);
  const contributions = scaleBreakdown(snapshot.contributions, p);

  return {
    incomeBeforeTax: scale(snapshot.incomeBeforeTax),
    incomeAfterTax: scale(snapshot.incomeAfterTax),
    totalTax: scale(snapshot.totalTax),
    contributions,
    carryForward: buildCarryForwardItems(contributions, null, false),
    taxYear: snapshot.taxYear,
    source: snapshot.source,
    yearsIncluded: snapshot.yearsIncluded,
  };
}

function mergeOverviewSnapshots(
  base: HouseholdOverviewSnapshot,
  addition: HouseholdOverviewSnapshot
): HouseholdOverviewSnapshot {
  const contributions = addBreakdowns(base.contributions, addition.contributions);

  return {
    incomeBeforeTax: base.incomeBeforeTax + addition.incomeBeforeTax,
    incomeAfterTax: base.incomeAfterTax + addition.incomeAfterTax,
    totalTax: base.totalTax + addition.totalTax,
    contributions,
    carryForward: buildCarryForwardItems(contributions, null, false),
    source: "aggregate",
    yearsIncluded: (base.yearsIncluded ?? 0) + (addition.yearsIncluded ?? 1),
  };
}

/** Sum completed years plus current-year YTD (not full-year projections). */
export function aggregateLifetimeToDate(params: {
  completedYearProfiles: TaxProfile[];
  currentYearSnapshot: HouseholdOverviewSnapshot | null;
  yearProgress: number;
}): HouseholdOverviewSnapshot {
  const { completedYearProfiles, currentYearSnapshot, yearProgress } = params;

  let result =
    completedYearProfiles.length > 0
      ? aggregateOverviewSnapshots(completedYearProfiles)
      : {
          incomeBeforeTax: 0,
          incomeAfterTax: 0,
          totalTax: 0,
          contributions: {
            pretax401k: 0,
            afterTax401k: 0,
            pretaxIra: 0,
            afterTaxIra: 0,
            hsa: 0,
            employerMatch: 0,
          },
          carryForward: [] as CarryForwardItem[],
          source: "aggregate" as const,
          yearsIncluded: 0,
        };

  if (currentYearSnapshot && yearProgress > 0) {
    const ytd = scaleOverviewSnapshot(
      { ...currentYearSnapshot, yearsIncluded: 1 },
      yearProgress
    );
    result = mergeOverviewSnapshots(result, ytd);
  }

  return result;
}

export function aggregateOverviewSnapshots(
  profiles: TaxProfile[]
): HouseholdOverviewSnapshot {
  if (profiles.length === 0) {
    return {
      incomeBeforeTax: 0,
      incomeAfterTax: 0,
      totalTax: 0,
      contributions: {
        pretax401k: 0,
        afterTax401k: 0,
        pretaxIra: 0,
        afterTaxIra: 0,
        hsa: 0,
        employerMatch: 0,
      },
      carryForward: [],
      source: "aggregate",
      yearsIncluded: 0,
    };
  }

  let incomeBeforeTax = 0;
  let totalTax = 0;
  let contributions: HouseholdContributionBreakdown = {
    pretax401k: 0,
    afterTax401k: 0,
    pretaxIra: 0,
    afterTaxIra: 0,
    hsa: 0,
    employerMatch: 0,
  };

  for (const profile of profiles) {
    const snapshot = buildOverviewFromTaxProfile(profile);
    incomeBeforeTax += snapshot.incomeBeforeTax;
    totalTax += snapshot.totalTax;
    contributions = addBreakdowns(contributions, snapshot.contributions);
  }

  return {
    incomeBeforeTax,
    incomeAfterTax: Math.max(0, incomeBeforeTax - totalTax),
    totalTax,
    contributions,
    carryForward: buildCarryForwardItems(contributions, null, false),
    source: "aggregate",
    yearsIncluded: profiles.length,
  };
}
