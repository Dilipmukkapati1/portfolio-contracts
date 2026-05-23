import { describe, it, expect } from "vitest";
import {
  HouseholdSchema,
  QueueMessageSchema,
  parseQueueMessage,
  serializeQueueMessage,
  TaxYearInputSchema,
} from "./index.js";

describe("@portfolio/contracts", () => {
  it("round-trips household schema", () => {
    const household = {
      id: "hh-1",
      householdId: "hh-1",
      displayName: "Test Family",
      state: "CA",
      filingStatus: "married_filing_jointly" as const,
      dependents: 2,
      persona: "family_with_kids" as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(HouseholdSchema.parse(household)).toEqual(household);
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
});
