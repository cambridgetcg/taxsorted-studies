// SPDX-License-Identifier: AGPL-3.0-only
// Authored copy: CC BY-SA 4.0 — TaxSorted (taxsorted.io).
// Grounded in docs/TAX-COMPARISON-MOTIFS.md; this is reading structure, not tax logic.
export type MotifId = "recognition" | "time" | "choice" | "repair";

type Motif = {
  numeral: string;
  name: string;
  question: string;
  thought: string;
  inStudy: string;
  connection: string;
  next: MotifId;
};

export const motifOrder: readonly MotifId[] = ["recognition", "time", "choice", "repair"];

export const motifs: Record<MotifId, Motif> = {
  recognition: {
    numeral: "I",
    name: "Recognition",
    question: "Which facts and rules apply?",
    thought: "Begin with what is there. A record, an activity, a circumstance: the details decide which question can honestly be asked.",
    inStudy: "Identify the record basis, sector, registration date and narrow supported scope. These are supplied facts, not verified evidence. The stored rules are not admitted for current advice.",
    connection: "A fact needs its place in time. The period changes which rules need to be checked.",
    next: "time",
  },
  time: {
    numeral: "II",
    name: "Time",
    question: "Which period, which window?",
    thought: "A past period and a future opportunity are different things. Keep the date beside the evidence; do not let a window become a promise.",
    inStudy: "The model accepts only completed calendar quarters and pauses at a first-year-discount anniversary crossing. It does not assess an election window or turn a past quarter into a future year.",
    connection: "A shared period gives a comparison its frame. Only then can alternatives be read together.",
    next: "choice",
  },
  choice: {
    numeral: "III",
    name: "Choice",
    question: "What changes when the facts stay the same?",
    thought: "Hold the facts steady. Look at supported alternatives side by side, and keep a modelled difference separate from a decision.",
    inStudy: "Standard VAT and Flat Rate use the same figures. The signed, period-only liability difference is not a recommendation, an available scheme change or a future saving.",
    connection: "A comparison may reveal a question about an earlier record. That is a reason to look again, not a refund claim.",
    next: "repair",
  },
  repair: {
    numeral: "IV",
    name: "Repair",
    question: "What can be put right?",
    thought: "Leave room to return. When a record looks wrong, correction remains a question worth asking, with evidence and care.",
    inStudy: "The study links to help and corrections. It does not establish amendment rights, appeal deadlines or refund entitlement. A lower modelled amount is not a guaranteed remedy.",
    connection: "A corrected record brings us back to recognition: what do we now know, and what still needs checking?",
    next: "recognition",
  },
};
