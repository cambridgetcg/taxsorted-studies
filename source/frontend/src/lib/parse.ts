// i18n: deferred to M2 — plain English for launch

export const INVALID_AMOUNT_MESSAGE = "Enter a number, like 40000 or 40,000.50";

type DecimalParts = { whole: string; fraction: string } | "blank" | "invalid";

function decimalParts(raw: string): DecimalParts {
  if (raw.trim() === "") return "blank";
  const sanitized = raw.replace(/[£,\s]/g, "");
  if (sanitized === "") return "invalid";
  const match = sanitized.match(/^(\d*)(?:\.(\d*))?$/);
  if (!match || (match[1] === "" && (match[2] ?? "") === "")) return "invalid";
  return { whole: match[1] || "0", fraction: match[2] ?? "" };
}

/**
 * Pounds as the user typed them -> integer pence, tolerating the ways people
 * really write money: "£40,000", "40 000.50", "40000". Currency signs, commas
 * and spaces are stripped before parsing. A blank field is 'blank' (the
 * caller decides what that means); anything non-blank that still doesn't
 * parse to a finite number >= 0 is 'invalid' and must block submission —
 * silently reading it as zero would produce a confidently wrong result.
 */
export function parsePounds(raw: string): number | "blank" | "invalid" {
  const parts = decimalParts(raw);
  if (typeof parts === "string") return parts;
  const wholePounds = BigInt(parts.whole);
  const fraction = parts.fraction;
  const firstTwoDigits = (fraction + "00").slice(0, 2);
  let exactPence = wholePounds * BigInt(100) + BigInt(firstTwoDigits);
  if (Number(fraction[2] ?? "0") >= 5) exactPence += BigInt(1);
  if (exactPence > BigInt(Number.MAX_SAFE_INTEGER)) return "invalid";
  return Number(exactPence);
}

/** Pounds -> integer pence without silently rounding a fraction of a penny. */
export function parseExactPounds(raw: string): number | "blank" | "invalid" {
  const parts = decimalParts(raw);
  if (typeof parts === "string") return parts;
  if (/[1-9]/.test(parts.fraction.slice(2))) return "invalid";
  return parsePounds(raw);
}

/**
 * Pounds -> exact integer quarter-pence for ANI values derived from ×1.25 gross-ups.
 * Values finer than £0.0025 are rejected instead of being rounded across a threshold.
 */
export function parsePoundsToQuarterPence(raw: string): number | "blank" | "invalid" {
  const parts = decimalParts(raw);
  if (typeof parts === "string") return parts;
  if (/[1-9]/.test(parts.fraction.slice(4))) return "invalid";

  const tenThousandths = (
    BigInt(parts.whole) * BigInt(10_000)
    + BigInt((parts.fraction + "0000").slice(0, 4))
  );
  if (tenThousandths % BigInt(25) !== BigInt(0)) return "invalid";
  const quarterPence = tenThousandths / BigInt(25);
  if (quarterPence > BigInt(Number.MAX_SAFE_INTEGER)) return "invalid";
  return Number(quarterPence);
}

/** Pence for a field already known not to be 'invalid'; blank reads as zero. */
export function penceOf(raw: string): number {
  const parsed = parsePounds(raw);
  return typeof parsed === "number" ? parsed : 0;
}
