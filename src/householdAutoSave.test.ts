import { describe, expect, it } from "vitest";
import type { Member } from "./dtos/member.js";
import {
  annualizeIncomeAmount,
  enrichPatchWithInferredMembers,
  inferMemberPatchesFromMessage,
  mergeMemberPatches,
  resolveContributionAmount,
} from "./dtos/householdAutoSave.js";

function member(overrides: Partial<Member> & Pick<Member, "id" | "name">): Member {
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

const ctx = {
  taxYear: 2026,
  filingStatus: "married_filing_jointly" as const,
  dependentCount: 0,
  rules: {
    retirement401kLimit: 24500,
    hsaSingleLimit: 4400,
    hsaFamilyLimit: 8750,
  },
};

describe("annualizeIncomeAmount", () => {
  it("annualizes monthly income", () => {
    expect(annualizeIncomeAmount(10000, "monthly")).toBe(120000);
  });
});

describe("resolveContributionAmount", () => {
  it("resolves max 401k from rule pack", () => {
    expect(
      resolveContributionAmount("401k", "max", undefined, ctx)
    ).toBe(24500);
  });

  it("resolves max HSA for MFJ as family limit", () => {
    expect(resolveContributionAmount("hsa", "max", undefined, ctx)).toBe(8750);
  });

  it("resolves max HSA for single filer as single limit", () => {
    expect(
      resolveContributionAmount("hsa", "max", undefined, {
        ...ctx,
        filingStatus: "single",
      })
    ).toBe(4400);
  });

  it("resolves half_max 401k", () => {
    expect(
      resolveContributionAmount("401k", "half_max", undefined, ctx)
    ).toBe(12250);
  });
});

describe("mergeMemberPatches", () => {
  it("upserts wages on self member and preserves others", () => {
    const existing = [
      member({ id: "m1", name: "Alex", relationship: "self" }),
      member({ id: "m2", name: "Jordan", relationship: "spouse" }),
    ];
    const merged = mergeMemberPatches(
      existing,
      [
        {
          matchName: "Alex",
          incomeSources: [{ type: "wages", amount: 150000, period: "annual" }],
        },
      ],
      { householdId: "hh1", contributionContext: ctx }
    );
    expect(merged).toHaveLength(2);
    expect(merged[0]!.incomeSources).toEqual([
      expect.objectContaining({ type: "wages", amount: 150000 }),
    ]);
    expect(merged[1]!.incomeSources).toEqual([]);
  });

  it("adds spouse member when not found", () => {
    const existing = [member({ id: "m1", name: "Alex", relationship: "self" })];
    const merged = mergeMemberPatches(
      existing,
      [
        {
          matchName: "Sam",
          name: "Sam",
          relationship: "spouse",
          incomeSources: [{ type: "wages", amount: 80000 }],
        },
      ],
      { householdId: "hh1", contributionContext: ctx }
    );
    expect(merged).toHaveLength(2);
    expect(merged[1]).toMatchObject({
      name: "Sam",
      relationship: "spouse",
      incomeSources: [expect.objectContaining({ amount: 80000 })],
    });
  });

  it("upserts 401k contribution by type", () => {
    const existing = [
      member({
        id: "m1",
        name: "Alex",
        relationship: "self",
        contributions: [{ id: "c1", type: "401k", amount: 10000 }],
      }),
    ];
    const merged = mergeMemberPatches(
      existing,
      [
        {
          matchName: "Alex",
          contributions: [
            { type: "401k", amountExpression: "max", updateMode: "set" },
          ],
        },
      ],
      { householdId: "hh1", contributionContext: ctx }
    );
    expect(merged[0]!.contributions[0]).toMatchObject({
      type: "401k",
      amount: 24500,
    });
  });

  it("matches member by self alias", () => {
    const existing = [
      member({ id: "m1", name: "Primary earner", relationship: "self" }),
    ];
    const merged = mergeMemberPatches(
      existing,
      [
        {
          matchName: "self",
          contributions: [
            { type: "401k", amountExpression: "max", updateMode: "set" },
          ],
        },
      ],
      { householdId: "hh1", contributionContext: ctx }
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]!.contributions[0]).toMatchObject({ amount: 24500 });
  });
});

describe("inferMemberPatchesFromMessage", () => {
  const members = [
    member({ id: "m1", name: "Alex", relationship: "self" }),
    member({ id: "m2", name: "Jordan", relationship: "spouse" }),
  ];

  it("infers max 401k for self on I maxed out my 401k", () => {
    const patches = inferMemberPatchesFromMessage(
      "I maxed out my 401k this year",
      members
    );
    expect(patches).toHaveLength(1);
    expect(patches[0]).toMatchObject({
      matchName: "Alex",
      contributions: [{ type: "401k", amountExpression: "max" }],
    });
  });

  it("infers max 401k for both earners when user says we", () => {
    const patches = inferMemberPatchesFromMessage(
      "We maxed out 401k contributions",
      members
    );
    expect(patches).toHaveLength(2);
    expect(patches.map((p) => p.matchName).sort()).toEqual(["Alex", "Jordan"]);
  });

  it("infers salary from Salary $150k", () => {
    const patches = inferMemberPatchesFromMessage("Salary $150k", members);
    expect(patches).toHaveLength(1);
    expect(patches[0]).toMatchObject({
      matchName: "Alex",
      incomeSources: [
        { type: "wages", amount: 150000, period: "annual", updateMode: "set" },
      ],
    });
  });

  it("infers annualized 401k from $500/mo to 401(k)", () => {
    const patches = inferMemberPatchesFromMessage("$500/mo to 401(k)", members);
    expect(patches).toHaveLength(1);
    expect(patches[0]?.contributions?.[0]).toMatchObject({
      type: "401k",
      amount: 6000,
      amountExpression: "explicit",
    });
  });

  it("infers max HSA from Max HSA", () => {
    const patches = inferMemberPatchesFromMessage("Max HSA", [members[0]!]);
    expect(patches[0]?.contributions?.[0]).toMatchObject({
      type: "hsa",
      amountExpression: "max",
    });
  });
});

describe("enrichPatchWithInferredMembers", () => {
  it("adds inferred patches when LLM patch is empty", () => {
    const inferred = inferMemberPatchesFromMessage("maxed out 401k", [
      member({ id: "m1", name: "Alex", relationship: "self" }),
    ]);
    const enriched = enrichPatchWithInferredMembers({}, inferred);
    expect(enriched.members).toHaveLength(1);
  });
});
