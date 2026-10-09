// i18n: deferred to M2 — plain English for launch

/** Pence (integer minor units) formatted as full GBP, e.g. 1143200 -> "£11,432.00" */
export function gbp(pence: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(pence / 100);
}

/**
 * Pence formatted as GBP, dropping the pence when the amount is a whole
 * pound: 1143200 -> "£11,432"; 245660 -> "£2,456.60".
 */
export function gbpCompact(pence: number): string {
  const isWhole = pence % 100 === 0;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: isWhole ? 0 : 2,
  }).format(pence / 100);
}

const UK_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * ISO 'YYYY-MM-DD' -> '7 August 2026'. Built from a fixed month-name table
 * rather than toLocaleDateString/Intl so the output can never drift with a
 * runtime's locale data — same string in a test, a build server and a
 * reader's browser, regardless of where any of them think they are.
 */
export function formatUkDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${UK_MONTHS[m - 1]} ${y}`;
}

/**
 * UTC ISO datetime (a server timestamp, 'YYYY-MM-DDTHH:MM:SS.sssZ') ->
 * '7 August 2026, 14:03 UTC'. Same deterministic-table approach as
 * formatUkDate (no toLocaleString) — the hour:minute is read straight off
 * the string, never reinterpreted through any runtime timezone. Deliberately
 * NO conversion to UK wall-clock: that would need a BST transition table
 * this codebase doesn't want to own, and an unlabelled UTC time shown during
 * British Summer Time would silently read an hour off — so the time carries
 * an explicit UTC label instead, which is honest year-round.
 */
export function formatUkDateTime(iso: string): string {
  const [datePart, timePart] = iso.split("T");
  const dateStr = formatUkDate(datePart);
  if (!timePart) return dateStr;
  return `${dateStr}, ${timePart.slice(0, 5)} UTC`;
}

/**
 * A HMRC calculation figure — already DECIMAL POUNDS, not pence — formatted
 * directly as GBP. Never pass a pence value here (use `gbp`/`gbpCompact` for
 * that); this exists specifically so HMRC's calculation endpoints (which
 * reply in pounds, unlike every pence figure elsewhere in this app) can
 * never be accidentally divided by 100 a second time.
 */
export function gbpFromPounds(pounds: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(pounds);
}
