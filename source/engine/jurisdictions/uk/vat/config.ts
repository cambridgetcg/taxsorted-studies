// Effective-dated tax config. Anything HMRC can change on a date lives here as a row,
// keyed by when it took effect — so a return is always computed against its own period's
// rules, and an update is a data edit, not a code change.
//
// Principle: dates and rates are versioned config, never constants.
// Sources: gov.uk/vat-rates · gov.uk/how-vat-works/vat-thresholds (verified 2026).

export interface Dated {
  /** ISO date this row took effect (inclusive). */
  effectiveFrom: string;
}

/** Pick the row in force on `periodDate` (the latest effectiveFrom on or before it). */
export function pick<T extends Dated>(table: T[], periodDate: string | Date): T {
  const d = typeof periodDate === "string" ? periodDate.slice(0, 10) : periodDate.toISOString().slice(0, 10);
  const row = [...table]
    .sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1)) // newest first
    .find((r) => r.effectiveFrom <= d);
  if (!row) throw new Error(`No config row in force for ${d}`);
  return row;
}

// ── VAT rates ────────────────────────────────────────────────────────────────
export interface VatRateRow extends Dated {
  standard: number;
  reduced: number;
  zero: number;
}
export const VAT_RATE_TABLE: VatRateRow[] = [
  { effectiveFrom: "2011-01-04", standard: 0.2, reduced: 0.05, zero: 0 },
];

// ── Registration / deregistration thresholds ─────────────────────────────────
export interface RegistrationRow extends Dated {
  /** Must register if rolling-12-month taxable turnover exceeds this. */
  registerOver: number;
  /** May deregister if turnover falls below this. */
  deregisterUnder: number;
}
export const REGISTRATION_TABLE: RegistrationRow[] = [
  { effectiveFrom: "2024-04-01", registerOver: 90000, deregisterUnder: 88000 },
  { effectiveFrom: "2017-04-01", registerOver: 85000, deregisterUnder: 83000 },
];

// ── Scheme eligibility limits ────────────────────────────────────────────────
export interface SchemeLimitsRow extends Dated {
  /** Flat Rate Scheme: join if turnover ex-VAT ≤ this. */
  frsJoinExVat: number;
  /** Flat Rate Scheme: must leave when gross income exceeds this. */
  frsLeaveIncVat: number;
  /** Cash & Annual Accounting: join if turnover ≤ this. */
  cashAnnualJoin: number;
  /** Cash & Annual Accounting: must leave when turnover exceeds this. */
  cashAnnualLeave: number;
}
export const SCHEME_LIMITS_TABLE: SchemeLimitsRow[] = [
  {
    effectiveFrom: "2017-04-01",
    frsJoinExVat: 150000,
    frsLeaveIncVat: 230000,
    cashAnnualJoin: 1_350_000,
    cashAnnualLeave: 1_600_000,
  },
];

// ── Flat Rate Scheme sector percentages (reference data — editable) ───────────
// A sample of the published sector rates; extend as needed. Limited-cost-trader (16.5%)
// and the 1% first-year discount are applied in compute.ts:effectiveFlatRate, not here.
export const FRS_SECTOR_RATES: Record<string, number> = {
  accountancy_bookkeeping: 0.145,
  it_consultancy: 0.145,
  management_consultancy: 0.14,
  photography: 0.11,
  hairdressing: 0.13,
  catering_restaurant: 0.125,
  retail_food: 0.04,
  retail_not_elsewhere: 0.075,
  general_building_labour_only: 0.145,
  printing: 0.085,
  any_other_activity: 0.12,
};

/** Convenience: the VAT rate set in force for a period. */
export function ratesFor(periodDate: string | Date): { standard: number; reduced: number; zero: number } {
  const { standard, reduced, zero } = pick(VAT_RATE_TABLE, periodDate);
  return { standard, reduced, zero };
}
