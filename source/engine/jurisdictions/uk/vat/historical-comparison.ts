import { VAT_RATES, type Transaction } from "./compute";
import { FRS_SECTOR_RATES, SCHEME_LIMITS_TABLE } from "./config";
import { compareSchemes } from "./optimiser";

export interface HistoricalVatComparisonInput {
  periodStart: string;
  periodEnd: string;
  /** Explicit caller clock: no hidden dependency on today's date. */
  asOf: string;
  registrationDate: string;
  sector: string;
  recordBasis: "illustrative-example" | "user-entered";
  scope: "unknown" | "needs-review" | "confirmed-simple-domestic";
  transactions: readonly Transaction[];
}

const boundary = {
  eligibility: "not-assessed",
  switchingWindow: "not-assessed",
  sourceReview: "not-admitted-for-advice",
  futureSaving: null,
} as const;

type Boundary = typeof boundary;

export type HistoricalVatComparison = Boundary & (
  | {
      status: "unavailable";
      reason: string;
      nextStep: string;
    }
  | {
      status: "illustrated";
      recordBasis: HistoricalVatComparisonInput["recordBasis"];
      period: { start: string; end: string };
      amounts: { standardPence: number; flatRatePence: number };
      effect: {
        kind: "modelled-vat-liability-difference";
        baseline: "standard";
        alternative: "flat-rate";
        currency: "GBP";
        /** Alternative minus baseline. Negative means a lower modelled liability. */
        amountPence: number;
      };
      flatRate: { rate: number; limitedCost: boolean; firstYearDiscount: boolean };
    }
);

function unavailable(reason: string, nextStep: string): HistoricalVatComparison {
  return { ...boundary, status: "unavailable", reason, nextStep };
}

function isDate(value: string): boolean {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function anniversaryOf(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  const year = date.getUTCFullYear() + 1;
  const month = date.getUTCMonth();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(date.getUTCDate(), lastDay))).toISOString().slice(0, 10);
}

const transactionFields = new Set(["kind", "net", "rate", "eu", "reclaimable", "goods"]);

function supportedTransactions(transactions: readonly Transaction[]): boolean {
  // Technical illustration bounds, not legal thresholds. Keep all penny totals safe.
  if (!Array.isArray(transactions) || transactions.length > 1000) return false;
  let netPence = 0;
  for (const transaction of transactions) {
    if (!transaction || typeof transaction !== "object") return false;
    if (Object.keys(transaction).some((key) => !transactionFields.has(key))) return false;
    if (transaction.kind !== "sale" && transaction.kind !== "purchase") return false;
    if (typeof transaction.net !== "number" || !Number.isFinite(transaction.net) || transaction.net < 0) return false;
    const pence = transaction.net * 100;
    if (Math.abs(pence - Math.round(pence)) > Number.EPSILON * Math.max(1, Math.abs(pence)) * 4) return false;
    netPence += Math.round(pence);
    if (!Number.isSafeInteger(netPence) || netPence > 1_000_000_000 * 100) return false;
    if (transaction.rate !== "standard" && transaction.rate !== VAT_RATES.standard) return false;
    if (transaction.eu !== undefined && transaction.eu !== false) return false;
    if (transaction.goods !== undefined && typeof transaction.goods !== "boolean") return false;
    if (transaction.reclaimable !== undefined && typeof transaction.reclaimable !== "boolean") return false;
    if (transaction.kind === "purchase" &&
        (transaction.goods === undefined || transaction.reclaimable === undefined)) return false;
  }
  return true;
}

/** Historical arithmetic only. It never establishes eligibility or a switching saving. */
export function compareHistoricalVatSchemes(input: HistoricalVatComparisonInput): HistoricalVatComparison {
  if (input.scope !== "confirmed-simple-domestic") {
    return unavailable("scope-not-confirmed", "Check that the figures cover one complete quarter of simple domestic standard-rated activity, without capital assets, imports, exempt activity, partial exemption, special schemes or adjustments.");
  }
  if (input.recordBasis !== "illustrative-example" && input.recordBasis !== "user-entered") {
    return unavailable("record-basis-required", "Identify these as fictional example figures or your manually entered figures; neither is verified evidence.");
  }
  if (![input.periodStart, input.periodEnd, input.asOf, input.registrationDate].every(isDate)) {
    return unavailable("invalid-date", "Supply valid period, registration and comparison dates in YYYY-MM-DD form.");
  }
  const start = new Date(`${input.periodStart}T00:00:00.000Z`);
  const quarterEnd = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 3, 0)).toISOString().slice(0, 10);
  if (start.getUTCDate() !== 1 || start.getUTCMonth() % 3 !== 0 || input.periodEnd !== quarterEnd) {
    return unavailable("unsupported-period", "Use one complete calendar quarter, starting on 1 January, April, July or October. Other periods need a different calculation.");
  }
  if (input.periodEnd >= input.asOf) {
    return unavailable("period-not-complete", "Wait until this calendar quarter has finished. This illustration does not forecast future records.");
  }
  if (!SCHEME_LIMITS_TABLE.some((row) => row.effectiveFrom <= input.periodStart)) {
    return unavailable("rules-not-covered", "The stored model does not cover this period. Find the rules for that period before comparing.");
  }
  if (input.registrationDate > input.periodStart) {
    return unavailable("registration-outside-period", "This first illustration needs registration on or before the quarter starts. A part-registration period needs separate treatment.");
  }
  const anniversary = anniversaryOf(input.registrationDate);
  if (input.periodStart < anniversary && input.periodEnd >= anniversary) {
    return unavailable("discount-boundary", "The first registration anniversary falls within this quarter. Split-date discount treatment is not covered by this model.");
  }
  if (!Object.hasOwn(FRS_SECTOR_RATES, input.sector)) {
    return unavailable("sector-not-covered", "Choose a covered sector. This model cannot establish your correct sector or handle several activities.");
  }
  if (!supportedTransactions(input.transactions)) {
    return unavailable("transactions-not-covered", "Use non-negative, penny-precision domestic standard-rated records, with explicit reclaimable-VAT and relevant-goods decisions for every purchase. Other rates, adjustments and extra transaction fields need review. This illustration supports at most 1,000 rows and £1 billion of combined net amounts.");
  }
  const replay = compareSchemes([...input.transactions], {
    periodKey: `${input.periodStart}/${input.periodEnd}`,
    periodEnd: input.periodEnd,
    registrationDate: input.registrationDate,
    sectorRate: FRS_SECTOR_RATES[input.sector],
    periodMonths: 3,
  });
  const standardPence = Math.round(replay.standard.cost * 100);
  const flatRatePence = Math.round(replay.flatRate.cost * 100);
  return {
    ...boundary,
    status: "illustrated",
    recordBasis: input.recordBasis,
    period: { start: input.periodStart, end: input.periodEnd },
    amounts: { standardPence, flatRatePence },
    effect: {
      kind: "modelled-vat-liability-difference",
      baseline: "standard",
      alternative: "flat-rate",
      currency: "GBP",
      amountPence: flatRatePence - standardPence,
    },
    flatRate: {
      rate: replay.flatRate.effectiveRate,
      limitedCost: replay.flatRate.limitedCost,
      firstYearDiscount: replay.flatRate.firstYearDiscount,
    },
  };
}
