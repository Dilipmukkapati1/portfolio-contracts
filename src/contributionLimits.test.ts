import { describe, expect, it } from "vitest";
import type { Member } from "./dtos/member.js";
import {
  allocateHouseholdLimit,
  hsaCoverage,
  normalizeHouseholdContributions,
  statutoryLimit,
  sumHouseholdContributions,
} from "./contributionLimits.js";

const ctx = {
  filingStatus: "married_filing_jointly" as const,
  dependentCount: 0,
  rules: {
    retirement401kLimit: 24500,
    hsaSingleLimit: 4400,
    hsaFamilyLimit: 8750,
    fsaDependentCareLimit: 5000,
    fsaDependentCareLimitMfs: 2500,
  },
};

function member(
  overrides: Partial<Member> & Pick<Member, "id" | "name">
): Member {
  const now = new Date().toISOString();
  return {
    householdId: "hh1",
    relationship: "self",
    isActive: true,
    incomeSources: [],
    contributions: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("contributionLimits", () => {
  it("detects family HSA coverage for MFJ", () => {
    expect(hsaCoverage(ctx)).toBe("family");
  });

  it("returns DCFSA household limit", () => {
    expect(statutoryLimit("fsa_dependent_care", ctx)).toBe(5000);
  });

  it("split_even allocates HSA across two targets", () => {
    const allocated = allocateHouseholdLimit({
      type: "hsa",
      targets: [
        { memberId: "m1", expression: "max" },
        { memberId: "m2", expression: "max" },
      ],
      existingMembers: [],
      ctx,
      strategy: "split_even",
    });
    expect(allocated.get("m1")).toBe(4375);
    expect(allocated.get("m2")).toBe(4375);
  });

  it("split_even allocates DCFSA across two targets", () => {
    const allocated = allocateHouseholdLimit({
      type: "fsa_dependent_care",
      targets: [
        { memberId: "m1", expression: "max" },
        { memberId: "m2", expression: "max" },
      ],
      existingMembers: [],
      ctx,
      strategy: "split_even",
    });
    expect(allocated.get("m1")).toBe(2500);
    expect(allocated.get("m2")).toBe(2500);
  });

  it("normalizeHouseholdContributions scales down overflow", () => {
    const members = [
      member({
        id: "m1",
        name: "A",
        contributions: [{ id: "c1", type: "hsa", amount: 8750 }],
      }),
      member({
        id: "m2",
        name: "B",
        relationship: "spouse",
        contributions: [{ id: "c2", type: "hsa", amount: 8750 }],
      }),
    ];
    const normalized = normalizeHouseholdContributions(members, ctx);
    expect(sumHouseholdContributions(normalized, "hsa")).toBe(8750);
  });
});
