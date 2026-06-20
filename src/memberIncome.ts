import type { ContributionLineItem, IncomeLineItem, Member } from "./dtos/member.js";

export function resolveBonusAmount(
  line: IncomeLineItem,
  wagesAmount: number
): number {
  if (line.type !== "bonus") return line.amount;
  if (line.amountMode === "percent_of_wages" && line.percent != null) {
    return Math.round((wagesAmount * line.percent) / 100);
  }
  return Math.max(0, line.amount);
}

export function resolveMemberIncomeAmounts(member: Member): {
  wages: number;
  bonus: number;
  cashIncome: number;
  byType: Record<string, number>;
} {
  const lines = member.incomeSources ?? [];
  const rawWages = lines
    .filter((l) => l.type === "wages")
    .reduce((sum, l) => sum + l.amount, 0);

  let bonus = 0;
  for (const line of lines.filter((l) => l.type === "bonus")) {
    bonus += resolveBonusAmount(line, rawWages);
  }

  const cashIncome = lines
    .filter((l) => l.type === "cash_income")
    .reduce((sum, l) => sum + l.amount, 0);

  const byType: Record<string, number> = {};
  for (const line of lines) {
    if (line.type === "bonus") {
      byType.bonus = (byType.bonus ?? 0) + resolveBonusAmount(line, rawWages);
    } else if (line.type !== "cash_income") {
      byType[line.type] = (byType[line.type] ?? 0) + line.amount;
    } else {
      byType.cash_income = (byType.cash_income ?? 0) + line.amount;
    }
  }

  return { wages: rawWages, bonus, cashIncome, byType };
}

export function resolveMemberContributionAmount(
  member: Member,
  line: ContributionLineItem
): number {
  if (line.type !== "employer_match") return line.amount;

  const mode = line.amountMode ?? "fixed";
  if (mode === "fixed") return Math.max(0, line.amount);

  const { wages, bonus } = resolveMemberIncomeAmounts(member);
  const percent = line.percent ?? 0;
  const base =
    mode === "percent_of_wages_and_bonus" ? wages + bonus : wages;
  return Math.round((base * percent) / 100);
}

export function resolveMemberContributions(member: Member): ContributionLineItem[] {
  return (member.contributions ?? []).map((line) => ({
    ...line,
    amount: resolveMemberContributionAmount(member, line),
  }));
}
