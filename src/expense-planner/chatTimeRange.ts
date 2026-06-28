import type { ExpenseChatTimeRange } from "../dtos/expenseChat.js";

export const EXPENSE_CHAT_MAX_RANGE_DAYS = 90;

export type { ExpenseChatTimeRange };

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function daysInRange(startDate: string, endDate: string): number {
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);
  return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

function formatRangeLabel(startDate: string, endDate: string): string {
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);
  const sameMonth =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth();
  if (sameMonth && start.getDate() === 1 && end.getDate() === endOfMonth(end).getDate()) {
    return start.toLocaleString("en-US", { month: "long", year: "numeric" });
  }
  if (startDate === endDate) {
    return start.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  const startFmt = start.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const endFmt = end.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${startFmt} – ${endFmt}`;
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

/** Default analysis window: start of current calendar month through today. */
export function defaultExpenseChatTimeRange(
  referenceDate: Date = new Date()
): ExpenseChatTimeRange {
  const start = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    1
  );
  const end = new Date(referenceDate);
  return {
    startDate: toIsoDate(start),
    endDate: toIsoDate(end),
    label: referenceDate.toLocaleString("en-US", {
      month: "long",
      year: "numeric",
    }),
  };
}

export function clampExpenseChatTimeRange(input: {
  startDate: string;
  endDate: string;
  label?: string;
}): {
  range: ExpenseChatTimeRange;
  wasClamped: boolean;
} {
  let startDate = input.startDate;
  let endDate = input.endDate;

  if (startDate > endDate) {
    [startDate, endDate] = [endDate, startDate];
  }

  const days = daysInRange(startDate, endDate);
  let wasClamped = false;

  if (days > EXPENSE_CHAT_MAX_RANGE_DAYS) {
    wasClamped = true;
    const end = parseIsoDate(endDate);
    const start = new Date(end);
    start.setDate(start.getDate() - (EXPENSE_CHAT_MAX_RANGE_DAYS - 1));
    startDate = toIsoDate(start);
  }

  return {
    range: {
      startDate,
      endDate,
      label: input.label?.trim() || formatRangeLabel(startDate, endDate),
    },
    wasClamped,
  };
}

export function resolveExpenseChatTimeRange(
  extracted: Partial<ExpenseChatTimeRange> | null | undefined,
  referenceDate: Date = new Date()
): { range: ExpenseChatTimeRange; wasClamped: boolean } {
  if (!extracted?.startDate || !extracted?.endDate) {
    return clampExpenseChatTimeRange(defaultExpenseChatTimeRange(referenceDate));
  }
  return clampExpenseChatTimeRange({
    startDate: extracted.startDate,
    endDate: extracted.endDate,
    label: extracted.label,
  });
}

/** Parse common natural-language date phrases from chat messages. */
export function extractTimeRangeFromMessage(
  message: string,
  referenceDate: Date = new Date()
): Partial<ExpenseChatTimeRange> | null {
  const m = message.toLowerCase();
  const ref = new Date(referenceDate);
  ref.setHours(12, 0, 0, 0);

  const lastDaysMatch = m.match(/last\s+(\d{1,3})\s+days?/);
  if (lastDaysMatch) {
    const days = Math.min(Number(lastDaysMatch[1]), EXPENSE_CHAT_MAX_RANGE_DAYS);
    const end = new Date(ref);
    const start = new Date(ref);
    start.setDate(start.getDate() - (days - 1));
    return {
      startDate: toIsoDate(start),
      endDate: toIsoDate(end),
      label: `Last ${days} days`,
    };
  }

  if (/last month|previous month/.test(m)) {
    const start = new Date(ref.getFullYear(), ref.getMonth() - 1, 1);
    const end = new Date(ref.getFullYear(), ref.getMonth(), 0);
    return {
      startDate: toIsoDate(start),
      endDate: toIsoDate(end),
      label: start.toLocaleString("en-US", { month: "long", year: "numeric" }),
    };
  }

  if (/this month|current month/.test(m)) {
    return defaultExpenseChatTimeRange(ref);
  }

  if (/last week|past week/.test(m)) {
    const end = new Date(ref);
    const start = new Date(ref);
    start.setDate(start.getDate() - 6);
    return {
      startDate: toIsoDate(start),
      endDate: toIsoDate(end),
      label: "Last 7 days",
    };
  }

  const isoRange = message.match(
    /(\d{4}-\d{2}-\d{2})\s*(?:to|through|-)\s*(\d{4}-\d{2}-\d{2})/
  );
  if (isoRange) {
    return {
      startDate: isoRange[1]!,
      endDate: isoRange[2]!,
    };
  }

  return null;
}
