"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  compareHistoricalVatSchemes, FRS_SECTOR_RATES,
  type HistoricalVatComparison, type HistoricalVatComparisonInput,
} from "@taxsorted/engine/uk/vat";
import { formatUkDate, gbp } from "@/lib/format";
import { INVALID_AMOUNT_MESSAGE, parseExactPounds } from "@/lib/parse";

const EMPTY = { periodStart: "", periodEnd: "", registrationDate: "", sector: "", sales: "", goods: "", other: "" };
type FieldErrors = Partial<Record<keyof typeof EMPTY | "scope", string>>;
const EXAMPLE = {
  periodStart: "2025-04-01", periodEnd: "2025-06-30", registrationDate: "2020-01-01",
  sector: "photography", sales: "10000", goods: "1000", other: "0",
};
const INPUTS = [
  ["periodStart", "Quarter start", "date"],
  ["periodEnd", "Quarter end", "date"],
  ["registrationDate", "VAT registration date", "date"],
  ["sales", "Standard-rated sales, excluding VAT (£)", "text"],
  ["goods", "Relevant-goods purchases, excluding VAT (£)", "text"],
  ["other", "Other fully reclaimable purchases, excluding VAT (£)", "text"],
] as const;
const fieldClass = "mt-2 min-h-12 w-full rounded-xl border border-line bg-white px-4 text-ink focus:border-accent focus:ring-2 focus:ring-accent/20";

export function VatComparisonClient({ standalone = false }: { standalone?: boolean } = {}) {
  const [fields, setFields] = useState(EMPTY);
  const [recordBasis, setRecordBasis] = useState<HistoricalVatComparisonInput["recordBasis"]>("user-entered");
  const [scope, setScope] = useState(false);
  const [result, setResult] = useState<HistoricalVatComparison | null>(null);
  const [asOf, setAsOf] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const errorRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (Object.keys(errors).length) errorRef.current?.focus();
    else if (result) resultRef.current?.focus();
  }, [errors, result]);

  function invalidate() {
    setResult(null);
    setErrors({});
  }

  function update(key: keyof typeof EMPTY, value: string) {
    setFields((current) => ({ ...current, [key]: value }));
    invalidate();
  }

  function load(fictional: boolean) {
    setFields(fictional ? EXAMPLE : EMPTY);
    setRecordBasis(fictional ? "illustrative-example" : "user-entered");
    setScope(fictional);
    invalidate();
  }

  function compare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(null);
    const amounts = { sales: parseExactPounds(fields.sales), goods: parseExactPounds(fields.goods), other: parseExactPounds(fields.other) };
    const nextErrors: FieldErrors = {};
    for (const key of ["periodStart", "periodEnd", "registrationDate"] as const) {
      if (!fields[key]) nextErrors[key] = "Enter a valid date.";
    }
    for (const key of ["sales", "goods", "other"] as const) {
      if (amounts[key] === "blank") nextErrors[key] = "Enter an amount, including 0 if there were none.";
      else if (amounts[key] === "invalid") nextErrors[key] = `${INVALID_AMOUNT_MESSAGE}. Use whole pennies; fractions of a penny are not accepted.`;
    }
    if (!Object.hasOwn(FRS_SECTOR_RATES, fields.sector)) nextErrors.sector = "Choose a sector; if unsure, check the official guidance first.";
    if (!scope) nextErrors.scope = "Confirm the scope only if it fits; otherwise leave it unchecked and seek review.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    const { sales, goods, other } = amounts;
    if (typeof sales !== "number" || typeof goods !== "number" || typeof other !== "number") return;
    const transactions: HistoricalVatComparisonInput["transactions"] = [
      { kind: "sale", net: sales / 100, rate: "standard" },
      { kind: "purchase", net: goods / 100, rate: "standard", reclaimable: true, goods: true },
      { kind: "purchase", net: other / 100, rate: "standard", reclaimable: true, goods: false },
    ];
    const today = new Date().toISOString().slice(0, 10);
    setAsOf(today);
    setResult(compareHistoricalVatSchemes({
      periodStart: fields.periodStart, periodEnd: fields.periodEnd, registrationDate: fields.registrationDate,
      sector: fields.sector, asOf: today, recordBasis,
      scope: scope ? "confirmed-simple-domestic" : "unknown",
      transactions: transactions.filter((transaction) => transaction.net > 0),
    }));
  }

  const errorFor = (key: keyof FieldErrors) => errors[key]
    ? <p id={`vat-${key}-error`} className="mt-2 text-sm font-medium text-warm">{errors[key]}</p> : null;

  return (
    <section id="vat-comparison" aria-labelledby="vat-comparison-title" className="mt-20 scroll-mt-24">
      <p className="section-label">VAT · Historical illustration only</p>
      <h2 id="vat-comparison-title" className="section-title mt-4 text-ink">Look back at one VAT quarter.</h2>
      <p className="mt-4 max-w-3xl text-lg leading-8 text-ink-soft">
        Compare the same manually entered records under standard VAT and the Flat Rate Scheme.
        This model does not establish eligibility, a switching opportunity or a future saving.
      </p>
      <p className="mt-4 max-w-3xl text-sm leading-6 text-ink-soft">
        Source review: not admitted for advice. This is not reviewed legal advice, a refund claim or a VAT return.
        Nothing is saved or sent, no Books records are read, and no account action is taken.
      </p>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <form onSubmit={compare} noValidate className="rounded-[2rem] border border-line bg-surface p-6 sm:p-8">
          {Object.keys(errors).length > 0 && (
            <div ref={errorRef} role="alert" tabIndex={-1} className="mb-5 rounded-xl border border-warm/40 bg-warm/5 p-3 text-sm font-medium text-ink">
              Check the marked fields. No figures have been calculated.
            </div>
          )}
          <p className="font-semibold text-ink">
            {recordBasis === "illustrative-example" ? "Fictional example — still fictional after edits." : "Your manually entered figures — not verified records."}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" onClick={() => load(true)} className="min-h-11 rounded-full border border-line-strong px-5 font-medium text-accent">Use a fictional example</button>
            <button type="button" onClick={() => load(false)} className="min-h-11 rounded-full border border-line-strong px-5 font-medium text-ink">Clear and enter my own figures</button>
          </div>
          <p id="vat-input-hint" className="mt-5 text-sm leading-6 text-ink-soft">
            Enter complete totals in pounds for the same past quarter, before VAT, without fractions of a penny. Enter 0 where there were none; a blank is not zero.
          </p>
          <div className="mt-5 space-y-5">
            {INPUTS.map(([key, label, type]) => (
              <div key={key}>
                <label htmlFor={`vat-${key}`} className="block font-semibold text-ink">{label}</label>
                <input id={`vat-${key}`} type={type} inputMode={type === "text" ? "decimal" : undefined}
                  value={fields[key]} onChange={(event) => update(key, event.target.value)}
                  aria-invalid={Boolean(errors[key])} aria-describedby={`vat-input-hint${errors[key] ? ` vat-${key}-error` : ""}`} className={fieldClass} />
                {errorFor(key)}
              </div>
            ))}
            <div>
              <label htmlFor="vat-sector" className="block font-semibold text-ink">Flat Rate Scheme sector</label>
              <select id="vat-sector" value={fields.sector} onChange={(event) => update("sector", event.target.value)}
                aria-invalid={Boolean(errors.sector)} aria-describedby={errors.sector ? "vat-sector-error" : undefined} className={fieldClass}>
                <option value="">Choose a sector</option>
                {Object.keys(FRS_SECTOR_RATES).map((sector) => <option key={sector} value={sector}>{sector.replaceAll("_", " ")}</option>)}
              </select>
              {errorFor("sector")}
            </div>
          </div>
          <div id="vat-scope-hint" className="mt-6 text-sm leading-6 text-ink-soft">
            <p>Only completed calendar quarters: 1 January–31 March, 1 April–30 June, 1 July–30 September or 1 October–31 December, starting on or after 1 April 2017.</p>
            <p className="mt-2">Registration must be on or before the quarter starts; the quarter cannot cross the first-year-discount anniversary.</p>
            <p className="mt-2">Only simple domestic standard-rated sales and fully reclaimable standard-rated purchases. No capital assets, imports, exempt or zero/reduced-rated activity, partial exemption, adjustments or special schemes.</p>
            <p className="mt-2">Use one business activity and one listed sector; this model cannot combine activities.</p>
            <p className="mt-2">Relevant goods means qualifying business goods, not services, capital assets, rent, fuel or gifts. Keep other fully reclaimable purchases separate; if unsure, leave the confirmation unchecked and seek review.</p>
          </div>
          <label className="mt-4 flex items-start gap-3 font-medium text-ink">
            <input type="checkbox" checked={scope} onChange={(event) => { setScope(event.target.checked); invalidate(); }}
              aria-invalid={Boolean(errors.scope)} aria-describedby={`vat-scope-hint${errors.scope ? " vat-scope-error" : ""}`}
              className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-accent)]" />
            I confirm the figures are complete and fit this simple domestic scope.
          </label>
          {errorFor("scope")}
          <button type="submit" className="mt-6 min-h-12 rounded-full bg-accent px-6 font-semibold text-white hover:bg-accent-deep">Compare this past quarter</button>
        </form>
        <div ref={resultRef} role="region" aria-label="Historical VAT illustration" tabIndex={-1} aria-live="polite" className="h-fit rounded-[2rem] border border-line bg-paper p-6 sm:p-8">
          {!result ? <p className="text-ink-soft">Your historical illustration will appear here.</p> : result.status === "unavailable" ? (
            <><h3 className="font-display text-2xl text-ink">Illustration paused — needs review</h3><p className="mt-4 text-ink-soft">{result.nextStep}</p></>
          ) : (
            <>
              <h3 className="font-display text-2xl text-ink">Modelled period amounts — not a recommendation</h3>
              <p className="mt-3 text-sm text-ink-soft">{result.recordBasis === "illustrative-example" ? "Fictional example" : "Manually entered figures, not verified records"} · {formatUkDate(result.period.start)} to {formatUkDate(result.period.end)}</p>
              <p className="mt-2 text-sm text-ink-soft">Compared as of {formatUkDate(asOf)} (browser clock, UTC).</p>
              <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                <div><dt className="text-sm text-ink-soft">Standard VAT model</dt><dd className="mt-2 font-display text-3xl text-ink">{gbp(result.amounts.standardPence)}</dd></div>
                <div><dt className="text-sm text-ink-soft">Flat Rate Scheme model</dt><dd className="mt-2 font-display text-3xl text-ink">{gbp(result.amounts.flatRatePence)}</dd></div>
              </dl>
              <p className="mt-5 font-semibold text-ink">
                {result.effect.amountPence === 0 ? "Both models show the same VAT amount for this period." : `The Flat Rate Scheme shows a ${gbp(Math.abs(result.effect.amountPence))} ${result.effect.amountPence < 0 ? "lower" : "higher"} modelled VAT amount for this period.`}
              </p>
              <div role="group" aria-label="Model assumptions" className="mt-5 rounded-xl border border-line p-4">
                <h4 className="font-semibold text-ink">How this model treated the figures</h4>
                <dl className="mt-3 space-y-2 text-sm text-ink">
                  {[
                    ["Flat rate used", new Intl.NumberFormat("en-GB", { style: "percent", maximumFractionDigits: 2 }).format(result.flatRate.rate)],
                    ["Limited-cost rule", result.flatRate.limitedCost ? "Applied" : "Not applied"],
                    ["First-year discount", result.flatRate.firstYearDiscount ? "Applied" : "Not applied"],
                  ].map(([label, value]) => (
                    <div key={label} className="flex flex-wrap justify-between gap-2"><dt>{label}</dt><dd className="font-medium">{value}</dd></div>
                  ))}
                </dl>
                <p className="mt-3 text-sm leading-6 text-ink-soft">These explain the stored model, not confirmed tax status or verified rules for your period.</p>
              </div>
              <p className="mt-4 text-sm leading-6 text-ink-soft">No scheme change, refund or return has been requested. Eligibility, switching dates, cash flow, record-keeping work and wider consequences remain unassessed. The decision stays yours.</p>
            </>
          )}
          <p className="mt-6 border-t border-line pt-5 text-sm leading-6 text-ink-soft">
            Check the <a href="https://www.gov.uk/vat-flat-rate-scheme" target={standalone ? "_blank" : undefined} rel={standalone ? "noopener noreferrer" : undefined} className="font-medium text-accent underline underline-offset-4">GOV.UK Flat Rate Scheme guidance{standalone && <span className="sr-only"> (opens in a new tab)</span>}</a>.
            {" "}If past records look wrong, <a href={standalone ? "https://taxsorted.io/put-it-right/" : "/put-it-right"} target={standalone ? "_blank" : undefined} rel={standalone ? "noopener noreferrer" : undefined} className="font-medium text-accent underline underline-offset-4">explore help and corrections{standalone && <span className="sr-only"> (opens in a new tab)</span>}</a>.
            Neither link establishes eligibility or determines a remedy.
          </p>
        </div>
      </div>
    </section>
  );
}
