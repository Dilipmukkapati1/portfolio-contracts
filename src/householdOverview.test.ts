import { describe, expect, it } from "vitest";
import type { Member } from "./dtos/member.js";
import type { TaxProfile } from "./dtos/taxProfile.js";
import {
  aggregateLifetimeToDate,
  aggregateOverviewSnapshots,
  buildOverviewFromMembers,
  buildOverviewFromTaxProfile,
  resolveHouseholdContributionBreakdown,
} from "./householdOverview.js";

const now = new Date().toISOString();

function member(partial: Partial<Member> & Pick<Member, "id">): Member {
  return {
    householdId: "hh1",
    name: "Alex",
    relationship: "self",
    isActive: true,
    incomeSources: [],
    contributions: [],
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

function taxProfile(partial: Partial<TaxProfile> & Pick<TaxProfile, "taxYear">): TaxProfile {
  return {
    id: `hh1:${partial.taxYear}`,
    householdId: "hh1",
    filingStatus: "single",
    dependentCount: 0,
    memberIds: [],
    inputs: {
      taxYear: partial.taxYear,
      filingStatus: "single",
      wages: 100_000,
      retirementContributions: 23_000,
      hsaContributions: 4_000,
    },
    contributionLimits: [],
    lastEstimate: {
      taxYear: partial.taxYear,
      adjustedGrossIncome: 73_000,
      taxableIncome: 58_000,
      standardDeduction: 15_000,
      federalTax: 8_500,
      effectiveRate: 0.085,
      marginalRate: 0.22,
    },
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

describe("householdOverview", () => {
  it("breaks contributions down by pre/post tax buckets", () => {
    const breakdown = resolveHouseholdContributionBreakdown([
      member({
        id: "m1",
        contributions: [
          { id: "c1", type: "401k", amount: 20_000 },
          { id: "c2", type: "traditional_ira", amount: 5_000 },
          { id: "c3", type: "roth_ira", amount: 6_000 },
          { id: "c4", type: "hsa", amount: 3_000 },
        ],
      }),
    ]);

    expect(breakdown).toEqual({
      pretax401k: 20_000,
      afterTax401k: 0,
      pretaxIra: 5_000,
      afterTaxIra: 6_000,
      hsa: 3_000,
      employerMatch: 0,
    });
  });

  it("builds live overview from members and tax outlook", () => {
    const snapshot = buildOverviewFromMembers(
      [
        member({
          id: "m1",
          incomeSources: [{ id: "w1", type: "wages", amount: 200_000 }],
          contributions: [{ id: "c1", type: "401k", amount: 23_000 }],
        }),
      ],
      taxProfile({ taxYear: 2026 }),
      { totalTaxAnnual: 45_000 }
    );

    expect(snapshot.incomeBeforeTax).toBe(200_000);
    expect(snapshot.incomeAfterTax).toBe(155_000);
    expect(snapshot.totalTax).toBe(45_000);
    expect(snapshot.contributions.pretax401k).toBe(23_000);
    expect(snapshot.source).toBe("live");
    expect(snapshot.carryForward.some((i) => i.id === "hsa-rollover")).toBe(false);
  });

  it("builds snapshot overview from tax profile", () => {
    const snapshot = buildOverviewFromTaxProfile(taxProfile({ taxYear: 2025 }));

    expect(snapshot.incomeBeforeTax).toBe(100_000);
    expect(snapshot.totalTax).toBe(8_500);
    expect(snapshot.incomeAfterTax).toBe(91_500);
    expect(snapshot.contributions.pretax401k).toBe(23_000);
    expect(snapshot.contributions.hsa).toBe(4_000);
    expect(snapshot.source).toBe("snapshot");
  });

  it("aggregates lifetime snapshots", () => {
    const aggregate = aggregateOverviewSnapshots([
      taxProfile({ taxYear: 2024, inputs: { taxYear: 2024, filingStatus: "single", wages: 90_000, retirementContributions: 10_000, hsaContributions: 1_000 } }),
      taxProfile({ taxYear: 2025 }),
    ]);

    expect(aggregate.incomeBeforeTax).toBe(190_000);
    expect(aggregate.contributions.pretax401k).toBe(33_000);
    expect(aggregate.contributions.hsa).toBe(5_000);
    expect(aggregate.yearsIncluded).toBe(2);
    expect(aggregate.source).toBe("aggregate");
  });

  it("aggregates to date with scaled current year", () => {
    const current = buildOverviewFromMembers(
      [
        member({
          id: "m1",
          incomeSources: [{ id: "w1", type: "wages", amount: 200_000 }],
          contributions: [{ id: "c1", type: "401k", amount: 20_000 }],
        }),
      ],
      taxProfile({ taxYear: 2026 }),
      { totalTaxAnnual: 40_000 }
    );

    const toDate = aggregateLifetimeToDate({
      completedYearProfiles: [taxProfile({ taxYear: 2025 })],
      currentYearSnapshot: current,
      yearProgress: 0.5,
    });

    expect(toDate.incomeBeforeTax).toBe(200_000);
    expect(toDate.contributions.pretax401k).toBe(33_000);
    expect(toDate.yearsIncluded).toBe(2);
  });
});
