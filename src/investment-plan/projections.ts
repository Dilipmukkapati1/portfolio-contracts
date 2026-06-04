import type {
  FundProfile,
  PlannedInstrument,
  ProjectionResponse,
  ReturnPeriod,
} from "../dtos/investmentPlan.js";
import { instrumentDollars } from "./rollup.js";

export const PROJECTION_MAX_YEARS = 40;
export const PROJECTION_HORIZONS = [10, 20, 30, 40] as const;
export const PROJECTION_YEAR_MARKS = Array.from(
  { length: PROJECTION_MAX_YEARS / 5 + 1 },
  (_, i) => i * 5
);

export function returnRateForPeriod(
  profile: FundProfile,
  period: ReturnPeriod
): number {
  switch (period) {
    case "1y":
      return profile.return1y;
    case "3y":
      return profile.return3y;
    case "5y":
      return profile.return5y;
    default:
      return profile.annualizedReturn;
  }
}

/** Annual rate for FV = P × (1 + r)^n; reinvested dividends compound with price return. */
export function compoundRateForProjection(
  profile: FundProfile,
  period: ReturnPeriod,
  reinvestDividends: boolean
): number {
  const priceReturn = returnRateForPeriod(profile, period);
  if (!reinvestDividends || profile.dividendYield <= 0) return priceReturn;
  return (1 + priceReturn) * (1 + profile.dividendYield) - 1;
}

export function projectedValue(
  principal: number,
  annualRate: number,
  years: number
): number {
  return principal * (1 + annualRate) ** years;
}

export function projectionGain(principal: number, future: number): number {
  return future - principal;
}

function buildProjectionResponse(
  totalPrincipal: number,
  legs: Array<{ principal: number; rate: number }>,
  instrumentCount?: number
): ProjectionResponse | null {
  if (totalPrincipal <= 0) return null;

  const values = PROJECTION_YEAR_MARKS.map((years) =>
    Math.round(
      legs.reduce(
        (sum, leg) => sum + projectedValue(leg.principal, leg.rate, years),
        0
      )
    )
  );

  const milestones = PROJECTION_HORIZONS.map((years) => {
    const idx = PROJECTION_YEAR_MARKS.indexOf(years);
    const future = values[idx] ?? values[values.length - 1];
    return {
      years,
      future,
      gain: projectionGain(totalPrincipal, future),
      multiple: future / totalPrincipal,
    };
  });

  return {
    totalPrincipal,
    instrumentCount,
    categories: PROJECTION_YEAR_MARKS.map((y) => (y === 0 ? "Today" : `Yr ${y}`)),
    values,
    milestones,
  };
}

export function computeInstrumentProjection(
  profile: FundProfile,
  principal: number,
  period: ReturnPeriod,
  reinvestDividends: boolean
): ProjectionResponse | null {
  if (principal <= 0) return null;
  const rate = compoundRateForProjection(profile, period, reinvestDividends);
  return buildProjectionResponse(principal, [{ principal, rate }], 1);
}

export function computePortfolioProjection(
  legs: Array<{ principal: number; profile: FundProfile }>,
  period: ReturnPeriod,
  reinvestDividends: boolean
): ProjectionResponse | null {
  if (legs.length === 0) return null;

  const computed = legs.map((leg) => ({
    principal: leg.principal,
    rate: compoundRateForProjection(leg.profile, period, reinvestDividends),
  }));
  const totalPrincipal = computed.reduce((sum, leg) => sum + leg.principal, 0);
  if (totalPrincipal <= 0) return null;

  return buildProjectionResponse(totalPrincipal, computed, legs.length);
}

export function computePlanProjection(
  planItems: PlannedInstrument[],
  netWorth: number,
  resolveProfile: (item: PlannedInstrument) => FundProfile,
  period: ReturnPeriod,
  reinvestDividends: boolean
): ProjectionResponse | null {
  if (planItems.length === 0) return null;

  const legs = planItems.map((item) => ({
    principal: instrumentDollars(item, netWorth),
    profile: resolveProfile(item),
  }));

  return computePortfolioProjection(legs, period, reinvestDividends);
}

export function formatReturnPct(rate: number): string {
  const pct = rate * 100;
  return `${pct.toFixed(1)}%`;
}

export function compoundRateBreakdown(
  profile: FundProfile,
  period: ReturnPeriod,
  reinvestDividends: boolean
): string {
  const priceReturn = returnRateForPeriod(profile, period);
  const compound = compoundRateForProjection(profile, period, reinvestDividends);
  if (!reinvestDividends || profile.dividendYield <= 0) {
    return formatReturnPct(priceReturn);
  }
  return `${formatReturnPct(priceReturn)} + ${formatReturnPct(profile.dividendYield)} div → ${formatReturnPct(compound)}`;
}
