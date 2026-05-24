import { describe, it, expect } from "vitest";
import {
  buildTaxProfileFromMembers,
  countDependents,
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
});
