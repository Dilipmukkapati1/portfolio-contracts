import { describe, it, expect } from "vitest";
import {
  buildTaxProfileFromMembers,
  computeContributionLimits,
  countDependents,
  prepareTaxInputForEstimate,
  sumDeductibleMemberContributions,
  sumMemberContributions,
  sumMemberIncome,
} from "./taxAggregation.js";
import type { Household } from "./dtos/household.js";
import type { Member } from "./dtos/member.js";

const baseHousehold: Household = {
  id: "hh-1",
  householdId: "hh-1",
  displayName: "Test Family",
  state: "CA",
  primaryState: "CA",
  persona: "family_with_kids",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function member(partial: Partial<Member> & Pick<Member, "id" | "name" | "relationship">): Member {
  const now = new Date().toISOString();
  return {
    householdId: "hh-1",
    isActive: true,
    incomeSources: [],
    contributions: [],
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

describe("taxAggregation", () => {
  it("sums income across active members", () => {
    const members = [
      member({
        id: "m1",
        name: "Alex",
        relationship: "self",
        incomeSources: [{ id: "i1", type: "wages", amount: 80000 }],
      }),
      member({
        id: "m2",
        name: "Sam",
        relationship: "spouse",
        incomeSources: [{ id: "i2", type: "wages", amount: 60000 }],
      }),
    ];
    const totals = sumMemberIncome(members);
    expect(totals.wages).toBe(140000);
  });

  it("counts dependents from member relationships", () => {
    const members = [
      member({ id: "m1", name: "Parent", relationship: "self" }),
      member({ id: "m2", name: "Child", relationship: "dependent" }),
    ];
    expect(countDependents(members)).toBe(1);
  });

  it("builds tax profile from members", () => {
    const members = [
      member({
        id: "m1",
        name: "Alex",
        relationship: "self",
        incomeSources: [{ id: "i1", type: "wages", amount: 90000 }],
        contributions: [{ id: "c1", type: "401k", amount: 5000 }],
      }),
      member({
        id: "m2",
        name: "Kid",
        relationship: "dependent",
      }),
    ];
    const profile = buildTaxProfileFromMembers(baseHousehold, members, {
      taxYear: 2025,
      filingStatus: "married_filing_jointly",
      rules: { retirement401kLimit: 23500, hsaFamilyLimit: 8550 },
    });
    expect(profile.inputs.wages).toBe(90000);
    expect(profile.dependentCount).toBe(1);
    expect(profile.inputs.dependents).toBe(1);
    expect(profile.inputs.retirementContributions).toBe(5000);
    expect(profile.memberIds).toEqual(["m1", "m2"]);
    expect(profile.id).toBe("hh-1:2025");
  });

  it("maps pre-tax and HSA contributions", () => {
    const members = [
      member({
        id: "m1",
        name: "Alex",
        relationship: "self",
        contributions: [
          { id: "c1", type: "401k", amount: 10000 },
          { id: "c2", type: "hsa", amount: 3000 },
          { id: "c3", type: "roth_ira", amount: 7000 },
        ],
      }),
    ];
    const totals = sumMemberContributions(members);
    expect(totals.retirementContributions).toBe(10000);
    expect(totals.hsaContributions).toBe(3000);
  });

  it("caps deductible retirement contributions per member at plan limit", () => {
    const members = [
      member({
        id: "m1",
        name: "Alex",
        relationship: "self",
        contributions: [{ id: "c1", type: "401k", amount: 24500 }],
      }),
      member({
        id: "m2",
        name: "Jordan",
        relationship: "spouse",
        contributions: [{ id: "c2", type: "401k", amount: 24500 }],
      }),
    ];
    const deductible = sumDeductibleMemberContributions(members, {
      retirement401kLimit: 24500,
    });
    expect(deductible.retirementContributions).toBe(49000);
  });

  it("caps deductible retirement contributions per member at 2025 plan limit", () => {
    const members = [
      member({
        id: "m1",
        name: "Alex",
        relationship: "self",
        contributions: [{ id: "c1", type: "401k", amount: 24500 }],
      }),
      member({
        id: "m2",
        name: "Jordan",
        relationship: "spouse",
        contributions: [{ id: "c2", type: "401k", amount: 24500 }],
      }),
    ];
    const deductible = sumDeductibleMemberContributions(members, {
      retirement401kLimit: 23500,
    });
    expect(deductible.retirementContributions).toBe(47000);
  });

  it("prepareTaxInputForEstimate folds deferrals into adjustments", () => {
    const prepared = prepareTaxInputForEstimate({
      taxYear: 2025,
      filingStatus: "single",
      wages: 395000,
      selfEmploymentIncome: 0,
      interestIncome: 0,
      dividendIncome: 0,
      capitalGainsShort: 0,
      capitalGainsLong: 0,
      otherIncome: 0,
      adjustments: 0,
      dependents: 0,
      retirementContributions: 47000,
      hsaContributions: 0,
    });
    expect(prepared.adjustments).toBe(47000);
    expect(prepared.retirementContributions).toBe(0);
    expect(prepared.hsaContributions).toBe(0);
  });

  it("deducts full family HSA when one spouse contributes max MFJ", () => {
    const members = [
      member({
        id: "m1",
        name: "Alex",
        relationship: "self",
        contributions: [{ id: "c1", type: "hsa", amount: 8750 }],
      }),
      member({ id: "m2", name: "Jordan", relationship: "spouse" }),
    ];
    const deductible = sumDeductibleMemberContributions(
      members,
      { hsaFamilyLimit: 8750, hsaSingleLimit: 4400 },
      "married_filing_jointly",
      0
    );
    expect(deductible.hsaContributions).toBe(8750);
  });

  it("aggregates bonus into wages", () => {
    const members = [
      member({
        id: "m1",
        name: "Alex",
        relationship: "self",
        incomeSources: [
          { id: "i1", type: "wages", amount: 100000 },
          {
            id: "i2",
            type: "bonus",
            amountMode: "percent_of_wages",
            percent: 10,
            amount: 0,
          },
        ],
      }),
    ];
    const totals = sumMemberIncome(members);
    expect(totals.wages).toBe(110000);
  });

  it("maps cash income to otherIncome", () => {
    const members = [
      member({
        id: "m1",
        name: "Alex",
        relationship: "self",
        incomeSources: [{ id: "i1", type: "cash_income", amount: 5000 }],
      }),
    ];
    const totals = sumMemberIncome(members);
    expect(totals.otherIncome).toBe(5000);
  });

  it("emits household-scoped HSA limit row for MFJ", () => {
    const members = [
      member({
        id: "m1",
        name: "Alex",
        relationship: "self",
        contributions: [{ id: "c1", type: "hsa", amount: 4375 }],
      }),
      member({
        id: "m2",
        name: "Jordan",
        relationship: "spouse",
        contributions: [{ id: "c2", type: "hsa", amount: 4375 }],
      }),
    ];
    const limits = computeContributionLimits(
      members,
      "married_filing_jointly",
      0,
      { hsaFamilyLimit: 8750 }
    );
    const hsa = limits.find((l) => l.type === "hsa");
    expect(hsa).toMatchObject({
      scope: "household",
      contributed: 8750,
      limit: 8750,
      remaining: 0,
    });
  });

  it("emits household-scoped DCFSA limit row", () => {
    const members = [
      member({
        id: "m1",
        name: "Alex",
        relationship: "self",
        contributions: [
          { id: "c1", type: "fsa_dependent_care", amount: 2500 },
        ],
      }),
      member({
        id: "m2",
        name: "Jordan",
        relationship: "spouse",
        contributions: [
          { id: "c2", type: "fsa_dependent_care", amount: 2500 },
        ],
      }),
    ];
    const limits = computeContributionLimits(
      members,
      "married_filing_jointly",
      0,
      { fsaDependentCareLimit: 5000 }
    );
    const dcfsa = limits.find((l) => l.type === "fsa_dependent_care");
    expect(dcfsa).toMatchObject({
      scope: "household",
      contributed: 5000,
      limit: 5000,
    });
  });
});
