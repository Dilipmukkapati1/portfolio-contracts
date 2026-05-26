import { describe, it, expect } from "vitest";
import {
  HouseholdSchema,
  MemberSchema,
  QueueMessageSchema,
  TaxProfileSchema,
  parseQueueMessage,
  serializeQueueMessage,
  TaxYearInputSchema,
  HoldingListViewResponseSchema,
  PrivacyUnlockRequestSchema,
  PrivacyUnlockResponseSchema,
  TransactionSummaryViewResponseSchema,
  DashboardAnalyticsResponseSchema,
} from "./index.js";

describe("@portfolio/contracts", () => {
  it("round-trips household schema", () => {
    const household = {
      id: "hh-1",
      householdId: "hh-1",
      displayName: "Test Family",
      state: "CA",
      primaryState: "CA",
      persona: "family_with_kids" as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(HouseholdSchema.parse(household)).toEqual(household);
  });

  it("round-trips member schema", () => {
    const now = new Date().toISOString();
    const member = {
      id: "m1",
      householdId: "hh-1",
      name: "Alex",
      relationship: "self" as const,
      isActive: true,
      incomeSources: [{ id: "i1", type: "wages" as const, amount: 50000 }],
      contributions: [],
      createdAt: now,
      updatedAt: now,
    };
    expect(MemberSchema.parse(member)).toEqual(member);
  });

  it("round-trips tax profile schema", () => {
    const now = new Date().toISOString();
    const profile = {
      id: "hh-1:2025",
      householdId: "hh-1",
      taxYear: 2025,
      filingStatus: "single" as const,
      dependentCount: 0,
      memberIds: [],
      inputs: {
        taxYear: 2025,
        filingStatus: "single" as const,
        wages: 0,
        dependents: 0,
      },
      createdAt: now,
      updatedAt: now,
    };
    expect(TaxProfileSchema.parse(profile).id).toBe("hh-1:2025");
  });

  it("parses queue message union", () => {
    const msg = { type: "sync.simplefin", householdId: "hh-1" };
    expect(QueueMessageSchema.parse(msg)).toEqual(msg);
    const serialized = serializeQueueMessage(msg);
    expect(parseQueueMessage(serialized)).toEqual(msg);
  });

  it("validates tax year input", () => {
    const input = TaxYearInputSchema.parse({
      taxYear: 2025,
      filingStatus: "single",
      wages: 85000,
    });
    expect(input.wages).toBe(85000);
  });

  it("parses locked privacy response envelopes without dollar fields", () => {
    const now = new Date().toISOString();
    const lockedHoldings = HoldingListViewResponseSchema.parse({
      privacyMode: "locked",
      valuesUnlocked: false,
      holdings: [
        {
          id: "h1",
          holdingId: "h1",
          accountId: "a1",
          symbol: "VTI",
          description: "Vanguard Total Stock Market ETF",
          category: "etf",
          portfolioPercent: 72.5,
          categoryPercent: 100,
          accountPercent: 80,
          createdAt: now,
          updatedAt: now,
        },
      ],
    });

    expect(lockedHoldings.valuesUnlocked).toBe(false);
    expect("marketValue" in lockedHoldings.holdings[0]!).toBe(false);
    expect("quantity" in lockedHoldings.holdings[0]!).toBe(false);

    expect(
      TransactionSummaryViewResponseSchema.parse({
        privacyMode: "locked",
        valuesUnlocked: false,
        spendByCategoryPercent: { food: 42.5 },
        transactionCount: 7,
      }).valuesUnlocked
    ).toBe(false);
  });

  it("parses privacy unlock and dashboard analytics contracts", () => {
    expect(
      PrivacyUnlockRequestSchema.parse({ password: "portfolio" }).password
    ).toBe("portfolio");
    expect(
      PrivacyUnlockResponseSchema.parse({
        privacyToken: "token",
        expiresAt: new Date().toISOString(),
      }).privacyToken
    ).toBe("token");

    const analytics = DashboardAnalyticsResponseSchema.parse({
      privacyMode: "locked",
      valuesUnlocked: false,
      allocation: [{ id: "etf", label: "ETF", percent: 80 }],
      spendByCategoryPercent: { food: 40, housing: 60 },
      transactionCount: 12,
      accountSections: [{ id: "investment", label: "Investments", percent: 90 }],
      freedomScore: {
        privacyMode: "locked",
        valuesUnlocked: false,
        score: 35,
      },
    });
    expect(analytics.privacyMode).toBe("locked");
  });
});
