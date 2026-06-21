import { describe, expect, it } from "vitest";
import type { Member } from "./dtos/member.js";
import {
  annualizeIncomeAmount,
  enrichPatchWithInferredMembers,
  inferMemberPatchesFromMessage,
  mergeMemberPatches,
  resolveContributionAmount,
  resolvedWagesForMember,
} from "./dtos/householdAutoSave.js";
import { resolveMemberContributionAmount } from "./memberIncome.js";

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
    fsaDependentCareLimit: 5000,
    fsaDependentCareLimitMfs: 2500,
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

  it("splits max HSA across both earners for MFJ", () => {
    const existing = [
      member({ id: "m1", name: "Alex", relationship: "self" }),
      member({ id: "m2", name: "Jordan", relationship: "spouse" }),
    ];
    const merged = mergeMemberPatches(
      existing,
      [
        {
          matchName: "Alex",
          contributions: [{ type: "hsa", amountExpression: "max", updateMode: "set" }],
        },
        {
          matchName: "Jordan",
          contributions: [{ type: "hsa", amountExpression: "max", updateMode: "set" }],
        },
      ],
      { householdId: "hh1", contributionContext: ctx }
    );
    const hsaTotal =
      (merged[0]!.contributions.find((c) => c.type === "hsa")?.amount ?? 0) +
      (merged[1]!.contributions.find((c) => c.type === "hsa")?.amount ?? 0);
    expect(hsaTotal).toBe(8750);
    expect(merged[0]!.contributions.find((c) => c.type === "hsa")?.amount).toBe(
      4375
    );
    expect(merged[1]!.contributions.find((c) => c.type === "hsa")?.amount).toBe(
      4375
    );
  });

  it("splits max DCFSA across both earners for MFJ", () => {
    const existing = [
      member({ id: "m1", name: "Alex", relationship: "self" }),
      member({ id: "m2", name: "Jordan", relationship: "spouse" }),
    ];
    const merged = mergeMemberPatches(
      existing,
      [
        {
          matchName: "Alex",
          contributions: [
            { type: "fsa_dependent_care", amountExpression: "max", updateMode: "set" },
          ],
        },
        {
          matchName: "Jordan",
          contributions: [
            { type: "fsa_dependent_care", amountExpression: "max", updateMode: "set" },
          ],
        },
      ],
      { householdId: "hh1", contributionContext: ctx }
    );
    const total =
      (merged[0]!.contributions.find((c) => c.type === "fsa_dependent_care")
        ?.amount ?? 0) +
      (merged[1]!.contributions.find((c) => c.type === "fsa_dependent_care")
        ?.amount ?? 0);
    expect(total).toBe(5000);
  });

  it("resolves percent bonus into wages aggregate", () => {
    const existing = [
      member({
        id: "m1",
        name: "Alex",
        incomeSources: [{ id: "i1", type: "wages", amount: 100000 }],
      }),
    ];
    const merged = mergeMemberPatches(
      existing,
      [
        {
          matchName: "Alex",
          incomeSources: [
            {
              type: "bonus",
              amountMode: "percent_of_wages",
              percent: 10,
              updateMode: "set",
            },
          ],
        },
      ],
      { householdId: "hh1", contributionContext: ctx }
    );
    expect(resolvedWagesForMember(merged[0]!)).toBe(110000);
  });

  it("resolves employer match on base plus bonus", () => {
    const existing = [
      member({
        id: "m1",
        name: "Alex",
        incomeSources: [
          { id: "i1", type: "wages", amount: 100000 },
          {
            id: "i2",
            type: "bonus",
            amountMode: "fixed",
            amount: 10000,
          },
        ],
      }),
    ];
    const merged = mergeMemberPatches(
      existing,
      [
        {
          matchName: "Alex",
          contributions: [
            {
              type: "employer_match",
              amountMode: "percent_of_wages_and_bonus",
              percent: 6,
              amountExpression: "explicit",
              updateMode: "set",
            },
          ],
        },
      ],
      { householdId: "hh1", contributionContext: ctx }
    );
    const line = merged[0]!.contributions.find((c) => c.type === "employer_match");
    expect(line?.amount).toBe(6600);
    expect(
      resolveMemberContributionAmount(merged[0]!, line!)
    ).toBe(6600);
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

  it("infers max DCFSA", () => {
    const patches = inferMemberPatchesFromMessage(
      "Max dependent care FSA",
      [members[0]!]
    );
    expect(patches[0]?.contributions?.[0]).toMatchObject({
      type: "fsa_dependent_care",
      amountExpression: "max",
    });
  });

  it("infers percent bonus", () => {
    const patches = inferMemberPatchesFromMessage("Bonus is 10% of salary", [
      members[0]!,
    ]);
    expect(patches[0]?.incomeSources?.[0]).toMatchObject({
      type: "bonus",
      amountMode: "percent_of_wages",
      percent: 10,
    });
  });

  it("infers percent bonus from dilip get 18% bonus on base salary", () => {
    const householdMembers = [
      member({ id: "m1", name: "Dilip", relationship: "self" }),
      member({ id: "m2", name: "Jordan", relationship: "spouse" }),
    ];
    const patches = inferMemberPatchesFromMessage(
      "dilip get 18% bonus on base salary",
      householdMembers
    );
    expect(patches).toHaveLength(1);
    expect(patches[0]).toMatchObject({
      matchName: "Dilip",
      incomeSources: [
        {
          type: "bonus",
          amountMode: "percent_of_wages",
          percent: 18,
        },
      ],
    });
  });

  it("infers 18% bonus on base salary phrasing", () => {
    const patches = inferMemberPatchesFromMessage(
      "18% bonus on base salary",
      [member({ id: "m1", name: "Alex", relationship: "self" })]
    );
    expect(patches[0]?.incomeSources?.[0]).toMatchObject({
      type: "bonus",
      percent: 18,
    });
  });

  it("infers fixed bonus for reshma bonus is 7k", () => {
    const householdMembers = [
      member({ id: "m1", name: "Dilip", relationship: "self" }),
      member({ id: "m2", name: "Reshma", relationship: "spouse" }),
    ];
    const patches = inferMemberPatchesFromMessage(
      "reshma bonus is 7k",
      householdMembers
    );
    expect(patches).toHaveLength(1);
    expect(patches[0]).toMatchObject({
      matchName: "Reshma",
      incomeSources: [
        {
          type: "bonus",
          amountMode: "fixed",
          amount: 7_000,
        },
      ],
    });
  });

  it("infers fixed bonus for reshma make 7k in bonus", () => {
    const householdMembers = [
      member({ id: "m1", name: "Dilip", relationship: "self" }),
      member({ id: "m2", name: "Reshma", relationship: "spouse" }),
    ];
    const patches = inferMemberPatchesFromMessage(
      "reshma make 7k in bonus",
      householdMembers
    );
    expect(patches).toHaveLength(1);
    expect(patches[0]).toMatchObject({
      matchName: "Reshma",
      incomeSources: [
        {
          type: "bonus",
          amountMode: "fixed",
          amount: 7_000,
        },
      ],
    });
  });

  it("infers add dependent", () => {
    const patches = inferMemberPatchesFromMessage("Add kid Emma", members);
    expect(patches[0]).toMatchObject({
      matchName: "Emma",
      name: "Emma",
      relationship: "dependent",
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
