// Turn raw bookkeeping into a VAT return.
//
// People have invoices and receipts — not nine pre-totalled boxes. This computes the
// HMRC 9-box return from a list of transactions, with HMRC's rounding rules applied:
//   - boxes 1–5: pounds AND pence (2 decimal places, to the nearest penny)
//   - boxes 6–9: whole pounds, ROUNDED DOWN ("knock off the pence", VAT Notice 700/12)
//
// Standard (accrual/cash) scheme. Flat Rate Scheme has its own helper below.
// Cross-box arithmetic per HMRC: Box 3 = Box 1 + Box 2 · Box 5 = |Box 3 − Box 4|.
// Boxes 2/8/9 apply to Northern Ireland Protocol goods movements only (post-Brexit).

import { addMonths } from "date-fns";
import type { VATReturnData } from "./types";

/** Standard UK VAT rates. Pass a number for anything bespoke. */
export const VAT_RATES = { standard: 0.2, reduced: 0.05, zero: 0 } as const;
export type NamedRate = keyof typeof VAT_RATES;

export interface Transaction {
  kind: "sale" | "purchase";
  /** Net amount, excluding VAT, in pounds. */
  net: number;
  /** VAT rate as a fraction (0.2) or a named rate ("standard"). */
  rate: number | NamedRate;
  /** NI-protocol goods movement: sales → Box 8, purchases → acquisitions (Box 2 + Box 9). */
  eu?: boolean;
  /** Purchases only: is the input VAT reclaimable? Defaults to true. */
  reclaimable?: boolean;
  /** Purchases only: counts as "relevant goods" for the Flat Rate limited-cost test
   *  (physical goods used in the business — excludes services, capital, rent, fuel, gifts). */
  goods?: boolean;
}

const rateOf = (r: number | NamedRate): number =>
  typeof r === "number" ? r : VAT_RATES[r];

const toDate = (d: Date | string): Date => (typeof d === "string" ? new Date(d) : d);

/** Round to pence (boxes 1–5). */
export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
/** Round DOWN to whole pounds (boxes 6–9) — HMRC "knock off the pence". */
export const round0 = (n: number): number => Math.floor(n + 1e-9);

/** Fill Box 3 and Box 5 from the input boxes, per HMRC arithmetic. */
export function deriveTotals(box1: number, box2: number, box4: number): { box3: number; box5: number } {
  const box3 = round2(box1 + box2);
  const box5 = round2(Math.abs(box3 - box4));
  return { box3, box5 };
}

/** Compute a complete, HMRC-ready 9-box return from transactions. */
export function computeReturnFromTransactions(
  transactions: Transaction[],
  opts: { periodKey: string; finalised?: boolean },
): VATReturnData {
  let outputVat = 0; // Box 1
  let acquisitionsVat = 0; // Box 2
  let inputVat = 0; // Box 4
  let salesNet = 0; // Box 6
  let purchasesNet = 0; // Box 7
  let euSalesNet = 0; // Box 8
  let euAcquisitionsNet = 0; // Box 9

  for (const t of transactions) {
    const rate = rateOf(t.rate);
    const vat = t.net * rate;
    if (t.kind === "sale") {
      salesNet += t.net;
      outputVat += vat;
      if (t.eu) euSalesNet += t.net;
    } else {
      purchasesNet += t.net;
      if (t.eu) {
        // NI-protocol acquisition reverse charge: the SAME VAT is both due (Box 2) and
        // reclaimed (Box 4) — exactly once each, netting to zero. This IS its input VAT,
        // so it does NOT also pass through the ordinary domestic reclaim below.
        euAcquisitionsNet += t.net;
        acquisitionsVat += vat;
        if (t.reclaimable !== false) inputVat += vat;
      } else if (t.reclaimable !== false) {
        inputVat += vat;
      }
    }
  }

  const box1 = round2(outputVat);
  const box2 = round2(acquisitionsVat);
  const box4 = round2(inputVat);
  const { box3, box5 } = deriveTotals(box1, box2, box4);

  return {
    periodKey: opts.periodKey,
    vatDueSales: box1,
    vatDueAcquisitions: box2,
    totalVatDue: box3,
    vatReclaimedCurrPeriod: box4,
    netVatDue: box5,
    totalValueSalesExVAT: round0(salesNet),
    totalValuePurchasesExVAT: round0(purchasesNet),
    totalValueGoodsSuppliedExVAT: round0(euSalesNet),
    totalAcquisitionsExVAT: round0(euAcquisitionsNet),
    finalised: opts.finalised ?? false,
  };
}

/**
 * The flat rate you actually pay — the headline FRS rules people get wrong:
 *  - Limited Cost Trader → forced 16.5%, regardless of sector, when spend on relevant
 *    goods is under 2% of gross FRS turnover OR under £1,000/yr (£250/quarter).
 *  - First-year 1% discount within 12 months of the VAT effective registration date.
 * So a new limited-cost trader correctly pays 15.5% in year one.
 */
export function effectiveFlatRate(params: {
  /** Your sector's published flat rate, e.g. 0.145 for 14.5%. */
  sectorRate: number;
  /** Gross (VAT-inclusive) flat-rate turnover for the period. */
  grossFrsTurnover: number;
  /** Gross spend on "relevant goods" in the period. */
  relevantGoodsSpend: number;
  /** VAT effective registration date — enables the 1% first-year discount. */
  registrationDate?: string | Date;
  /** This period's end date. */
  periodEnd?: string | Date;
  /** Length of the period in months (default 3 = a quarter). */
  periodMonths?: number;
}): { rate: number; limitedCost: boolean; firstYearDiscount: boolean } {
  const months = params.periodMonths ?? 3;
  const cashFloor = 1000 * (months / 12); // £250 per quarter
  const limitedCost =
    params.relevantGoodsSpend < 0.02 * params.grossFrsTurnover ||
    params.relevantGoodsSpend < cashFloor;

  let rate = limitedCost ? 0.165 : params.sectorRate;

  let firstYearDiscount = false;
  if (params.registrationDate && params.periodEnd) {
    const within12m = toDate(params.periodEnd) <= addMonths(toDate(params.registrationDate), 12);
    if (within12m) {
      rate = rate - 0.01;
      firstYearDiscount = true;
    }
  }
  return { rate: Math.max(0, Math.round(rate * 10000) / 10000), limitedCost, firstYearDiscount };
}

/**
 * Flat Rate Scheme return: you pay a flat % of VAT-INCLUSIVE turnover and don't reclaim
 * input VAT (except capital assets over £2,000). Pass a pre-computed `flatRate`
 * (use effectiveFlatRate to get it right).
 */
export function computeFlatRateReturn(
  opts: {
    periodKey: string;
    /** Gross (VAT-inclusive) flat-rate turnover for the period. */
    grossTurnover: number;
    /** The flat rate to apply — see effectiveFlatRate. */
    flatRate: number;
    /** Standard-rate sales net total, for Box 6 reporting. */
    salesNet: number;
    /** Reclaimable VAT on capital assets > £2,000 (the only FRS input VAT allowed). */
    capitalAssetVatReclaim?: number;
    finalised?: boolean;
  },
): VATReturnData {
  const box1 = round2(opts.grossTurnover * opts.flatRate);
  const box4 = round2(opts.capitalAssetVatReclaim ?? 0);
  const { box3, box5 } = deriveTotals(box1, 0, box4);
  return {
    periodKey: opts.periodKey,
    vatDueSales: box1,
    vatDueAcquisitions: 0,
    totalVatDue: box3,
    vatReclaimedCurrPeriod: box4,
    netVatDue: box5,
    totalValueSalesExVAT: round0(opts.salesNet),
    totalValuePurchasesExVAT: 0,
    totalValueGoodsSuppliedExVAT: 0,
    totalAcquisitionsExVAT: 0,
    finalised: opts.finalised ?? false,
  };
}
