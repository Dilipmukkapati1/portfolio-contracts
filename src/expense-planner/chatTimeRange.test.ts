import { describe, expect, it } from "vitest";
import {
  clampExpenseChatTimeRange,
  daysInRange,
  defaultExpenseChatTimeRange,
  extractTimeRangeFromMessage,
  EXPENSE_CHAT_MAX_RANGE_DAYS,
  resolveExpenseChatTimeRange,
} from "./chatTimeRange.js";

describe("defaultExpenseChatTimeRange", () => {
  it("defaults to current calendar month through today", () => {
    const ref = new Date(2026, 5, 23);
    const range = defaultExpenseChatTimeRange(ref);
    expect(range.startDate).toBe("2026-06-01");
    expect(range.endDate).toBe("2026-06-23");
    expect(range.label).toContain("June");
  });
});

describe("clampExpenseChatTimeRange", () => {
  it("keeps ranges within the 90-day limit", () => {
    const { range, wasClamped } = clampExpenseChatTimeRange({
      startDate: "2026-04-25",
      endDate: "2026-06-23",
    });
    expect(wasClamped).toBe(false);
    expect(range.startDate).toBe("2026-04-25");
    expect(range.endDate).toBe("2026-06-23");
  });

  it("uses the latest 90 days when the range exceeds the limit", () => {
    const { range, wasClamped } = clampExpenseChatTimeRange({
      startDate: "2025-01-01",
      endDate: "2026-06-23",
    });
    expect(wasClamped).toBe(true);
    expect(range.endDate).toBe("2026-06-23");
    expect(daysInRange(range.startDate, range.endDate)).toBe(
      EXPENSE_CHAT_MAX_RANGE_DAYS
    );
  });

  it("swaps inverted dates", () => {
    const { range } = clampExpenseChatTimeRange({
      startDate: "2026-06-20",
      endDate: "2026-06-01",
    });
    expect(range.startDate).toBe("2026-06-01");
    expect(range.endDate).toBe("2026-06-20");
  });
});

describe("resolveExpenseChatTimeRange", () => {
  it("defaults to the current month when extraction is empty", () => {
    const ref = new Date(2026, 5, 15);
    const { range } = resolveExpenseChatTimeRange(null, ref);
    expect(range.startDate).toBe("2026-06-01");
    expect(range.endDate).toBe("2026-06-15");
  });

  it("applies extracted range from chat", () => {
    const { range } = resolveExpenseChatTimeRange({
      startDate: "2026-05-01",
      endDate: "2026-05-31",
      label: "May 2026",
    });
    expect(range.startDate).toBe("2026-05-01");
    expect(range.endDate).toBe("2026-05-31");
  });
});

describe("extractTimeRangeFromMessage", () => {
  it("parses last N days", () => {
    const ref = new Date(2026, 5, 23);
    const extracted = extractTimeRangeFromMessage("use last 30 days", ref);
    expect(extracted?.endDate).toBe("2026-06-23");
    expect(extracted?.startDate).toBe("2026-05-25");
  });
});
