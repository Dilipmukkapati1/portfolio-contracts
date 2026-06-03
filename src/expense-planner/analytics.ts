import type { TransactionCategory } from "../enums.js";
import type { ExpenseCategoryPreference } from "../dtos/expensePlan.js";

export type DurationPreset =
  | "current-month"
  | "last-month"
  | "last-3-months"
  | "last-6-months"
  | "last-year"
  | "custom";

export type RedFlagTone = "danger" | "warning";

export type ExpenseRedFlag = {
  title: string;
  detail: string;
  tone: RedFlagTone;
};

export function monthlyBudgetTotal(
  categories: ExpenseCategoryPreference[]
): number {
  return categories
    .filter((c) => !c.hidden)
    .reduce((sum, c) => sum + c.monthlyBudget, 0);
}

export function budgetForDuration(
  duration: DurationPreset,
  monthlyTotal: number
): number {
  if (duration === "current-month" || duration === "last-month") {
    return monthlyTotal;
  }
  if (duration === "last-3-months") return monthlyTotal * 3;
  if (duration === "last-6-months") return monthlyTotal * 6;
  if (duration === "last-year") return monthlyTotal * 12;
  return monthlyTotal;
}

export function budgetUsedPercent(
  totalSpend: number,
  budgetForRange: number
): number {
  if (budgetForRange <= 0) return 0;
  return Math.min(150, (totalSpend / budgetForRange) * 100);
}

export function buildRedFlags(input: {
  totalSpend: number;
  budgetForRange: number;
  budgetUsedPct: number;
  duration: DurationPreset;
  rangeLabel: string;
  spendByCategory: Record<string, number>;
  categories: ExpenseCategoryPreference[];
  unmappedCount: number;
  unmappedAmount: number;
  dayOfMonth: number;
  referenceDate?: Date;
}): ExpenseRedFlag[] {
  const flags: ExpenseRedFlag[] = [];
  const isCurrentMonth = input.duration === "current-month";
  const isSingleMonth =
    input.duration === "current-month" || input.duration === "last-month";

  if (input.budgetUsedPct >= 100) {
    flags.push({
      tone: "danger",
      title: "Over total budget",
      detail: `Spent $${Math.round(input.totalSpend).toLocaleString()} vs $${Math.round(input.budgetForRange).toLocaleString()} planned for ${input.rangeLabel}.`,
    });
  } else if (input.budgetUsedPct >= 90 && isCurrentMonth) {
    flags.push({
      tone: "warning",
      title: "Approaching monthly budget cap",
      detail: `${Math.round(input.budgetUsedPct)}% of budget used with ${input.dayOfMonth} days elapsed.`,
    });
  }

  if (isSingleMonth) {
    for (const cat of input.categories) {
      if (cat.hidden) continue;
      const spent = input.spendByCategory[cat.category] ?? 0;
      const cap = cat.monthlyBudget;
      if (cap > 0 && spent > cap) {
        flags.push({
          tone: "danger",
          title: `${cat.label ?? cat.category} over budget`,
          detail: `$${Math.round(spent).toLocaleString()} spent vs $${Math.round(cap).toLocaleString()} planned.`,
        });
      } else if (cap > 0 && spent >= cap * 0.9 && isCurrentMonth) {
        flags.push({
          tone: "warning",
          title: `${cat.label ?? cat.category} at ${Math.round((spent / cap) * 100)}%`,
          detail: `Only $${Math.round(Math.max(0, cap - spent)).toLocaleString()} remaining this month.`,
        });
      }
    }
  }

  if (input.unmappedCount > 0) {
    flags.push({
      tone: "warning",
      title: `${input.unmappedCount} unmapped transaction${input.unmappedCount === 1 ? "" : "s"}`,
      detail: `$${Math.round(input.unmappedAmount).toLocaleString()} excluded from category view until mapped.`,
    });
  }

  return flags;
}

export function projectedMonthlyPace(
  spentSoFar: number,
  dayOfMonth: number,
  daysInMonth: number
): number {
  if (daysInMonth <= 0) return spentSoFar;
  const progress = dayOfMonth / daysInMonth;
  if (progress <= 0) return spentSoFar;
  return spentSoFar / progress;
}

export function categoryOutlook(input: {
  monthlyPace: number;
  monthCount: number;
  monthlyBudget: number;
  actualInPeriod: number;
}): {
  projected: number;
  budget: number;
  delta: number;
  actualInPeriod: number;
} {
  const projected = input.monthlyPace * input.monthCount;
  const budget = input.monthlyBudget * input.monthCount;
  return {
    projected,
    budget,
    delta: projected - budget,
    actualInPeriod: input.actualInPeriod,
  };
}

export function spendByCategoryForTransactions<
  T extends { amount: number; resolvedCategory: TransactionCategory | null }
>(
  transactions: T[],
  visibleCategoryIds: TransactionCategory[]
): Record<string, number> {
  const totals: Record<string, number> = Object.fromEntries(
    visibleCategoryIds.map((id) => [id, 0])
  );
  for (const t of transactions) {
    const cat = t.resolvedCategory;
    if (!cat) continue;
    totals[cat] = (totals[cat] ?? 0) + Math.abs(t.amount);
  }
  return totals;
}
