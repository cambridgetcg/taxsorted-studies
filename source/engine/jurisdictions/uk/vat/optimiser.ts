// Scheme optimiser — "you're on the wrong VAT scheme, switch and save £X."
//
// Replays a real transaction history under each scheme and returns the £ difference.
// Found money beats new features: this runs entirely on data the engine already has,
// it's pure and agent-callable, and it surfaces the limited-cost-trader trap where the
// Flat Rate Scheme quietly costs more than standard.
//
// Honest scope: Standard vs Flat Rate is where the £ LIABILITY actually differs.
// Cash and Annual Accounting change WHEN you pay and how often you file — not the total —
// so they're reported as advisory notes, not invented savings.

import { computeReturnFromTransactions, effectiveFlatRate, round2, VAT_RATES, type Transaction, type NamedRate } from "./compute";
import { pick, SCHEME_LIMITS_TABLE } from "./config";

const rateOf = (r: number | NamedRate): number => (typeof r === "number" ? r : VAT_RATES[r]);

// Decode penny inputs BEFORE multiplying by VAT/FRS rates. The tolerance only
// recognises input representation noise (as in the historical adapter's penny
// validation); it is never added to a tax product to push it across a half-penny.
// Genuine fractional-penny amounts, non-finite/unsafe values and rates finer
// than a basis point keep the legacy floating calculation below.
function inputPence(net: number): bigint | undefined {
  const scaled = net * 100;
  const pence = Math.round(scaled);
  if (!Number.isSafeInteger(pence) ||
      Math.abs(scaled - pence) > Number.EPSILON * Math.max(1, Math.abs(scaled)) * 4) return undefined;
  return BigInt(pence);
}

function rateBasisPoints(rate: number): bigint | undefined {
  const points = Math.round(rate * 10000);
  return Number.isSafeInteger(points) && points / 10000 === rate ? BigInt(points) : undefined;
}

/** grossUnits is in 1/10,000 of a penny, NOT gross rounded to pennies. */
function exactFlatRateCost(grossUnits: bigint | undefined, rate: number): number | undefined {
  const points = rateBasisPoints(rate);
  if (grossUnits === undefined || points === undefined) return undefined;
  const numerator = grossUnits * points;
  const denominator = BigInt(100_000_000);
  let pence = numerator / denominator;
  const remainder = numerator % denominator;
  // Nearest penny, with ties towards +infinity, matching legacy Math.round:
  // positive half-pennies round up; negative half-pennies round towards zero.
  // Do not silently impose half-away-from-zero on legacy signed transactions.
  if (remainder * BigInt(2) >= denominator) pence += BigInt(1);
  else if (remainder * BigInt(2) < -denominator) pence -= BigInt(1);
  const result = Number(pence);
  if (!Number.isSafeInteger(result)) return undefined;
  return pence === BigInt(0) && numerator < BigInt(0) ? -0 : result / 100;
}

export interface SchemeComparison {
  /** Signed period cost under standard accounting (positive = you pay HMRC, negative = refund). */
  standard: { cost: number };
  flatRate: {
    cost: number;
    effectiveRate: number;
    limitedCost: boolean;
    firstYearDiscount: boolean;
    eligible: boolean;
  };
  recommendation: "standard" | "flatRate";
  /** £ saved per period by following the recommendation vs the other scheme. */
  savingPerPeriod: number;
  /** Annualised saving. */
  savingPerYear: number;
  /** The headline sentence. */
  headline: string;
  notes: string[];
}

const gbp = (n: number): string =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);

/** Compare Standard vs Flat Rate for a transaction history, with eligibility + plain advice. */
export function compareSchemes(
  transactions: Transaction[],
  opts: {
    periodKey: string;
    /** Your sector's published flat rate (e.g. 0.145). */
    sectorRate: number;
    periodEnd?: string | Date;
    registrationDate?: string | Date;
    periodMonths?: number;
  },
): SchemeComparison {
  const months = opts.periodMonths ?? 3;
  const limits = pick(SCHEME_LIMITS_TABLE, opts.periodEnd ?? new Date());

  // Standard: signed liability for the period.
  const std = computeReturnFromTransactions(transactions, { periodKey: opts.periodKey });
  const standardCost = round2(std.totalVatDue - std.vatReclaimedCurrPeriod);

  // Flat Rate inputs, derived from the same transactions.
  let grossFrsTurnover = 0;
  let grossFrsUnits: bigint | undefined = BigInt(0);
  let exVatTurnover = 0;
  let relevantGoodsSpend = 0;
  for (const t of transactions) {
    const rate = rateOf(t.rate);
    const gross = t.net * (1 + rate);
    if (t.kind === "sale") {
      grossFrsTurnover += gross; // FRS turnover is ALL income, VAT-inclusive
      exVatTurnover += t.net;
      if (grossFrsUnits !== undefined) {
        const pence = inputPence(t.net);
        const points = rateBasisPoints(rate);
        grossFrsUnits = pence === undefined || points === undefined
          ? undefined
          : grossFrsUnits + pence * (BigInt(10000) + points);
      }
    } else if (t.goods) {
      relevantGoodsSpend += gross;
    }
  }

  const eff = effectiveFlatRate({
    sectorRate: opts.sectorRate,
    grossFrsTurnover,
    relevantGoodsSpend,
    registrationDate: opts.registrationDate,
    periodEnd: opts.periodEnd,
    periodMonths: months,
  });
  // Preserve fractional pennies throughout the period; round only the liability.
  // Keep the existing floating inputs for rule selection and legacy fallbacks.
  const flatRateCost = exactFlatRateCost(grossFrsUnits, eff.rate) ?? round2(grossFrsTurnover * eff.rate);

  // Eligibility: FRS join test is on expected next-12-months ex-VAT turnover.
  const annualisedExVat = exVatTurnover * (12 / months);
  const eligible = annualisedExVat <= limits.frsJoinExVat;

  const frsWins = eligible && flatRateCost < standardCost;
  const recommendation: "standard" | "flatRate" = frsWins ? "flatRate" : "standard";
  const savingPerPeriod = round2(Math.abs(standardCost - flatRateCost));
  const savingPerYear = round2(savingPerPeriod * (12 / months));

  const notes: string[] = [];
  if (!eligible) {
    notes.push(`Flat Rate Scheme needs turnover ≤ ${gbp(limits.frsJoinExVat)}/yr to join — you're at ~${gbp(annualisedExVat)}.`);
  }
  if (eff.limitedCost) {
    notes.push("You're a limited-cost trader, so Flat Rate is forced to 16.5% — usually worse than standard.");
  }
  if (eff.firstYearDiscount) {
    notes.push("Includes the 1% first-year Flat Rate discount (within 12 months of registration).");
  }
  notes.push("Cash & Annual Accounting change WHEN you pay and how often you file — not the total — so they're not scored here.");

  let headline: string;
  if (savingPerPeriod < 0.005) {
    headline = "Both schemes cost the same this period.";
  } else if (recommendation === "flatRate") {
    headline = `Switch to the Flat Rate Scheme and save ${gbp(savingPerYear)}/year.`;
  } else if (eligible) {
    headline = `Stay on standard accounting — the Flat Rate Scheme would cost you ${gbp(savingPerYear)}/year more.`;
  } else {
    headline = "Stay on standard accounting.";
  }

  return {
    standard: { cost: standardCost },
    flatRate: {
      cost: flatRateCost,
      effectiveRate: eff.rate,
      limitedCost: eff.limitedCost,
      firstYearDiscount: eff.firstYearDiscount,
      eligible,
    },
    recommendation,
    savingPerPeriod,
    savingPerYear,
    headline,
    notes,
  };
}
