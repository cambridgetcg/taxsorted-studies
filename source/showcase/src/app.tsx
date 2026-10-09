// SPDX-License-Identifier: AGPL-3.0-only
// Authored copy: CC BY-SA 4.0 — TaxSorted (taxsorted.io).
import { useState } from "react";
import { VatComparisonClient } from "../../frontend/src/app/plan/vat-comparison-client";
import { motifOrder, motifs, type MotifId } from "./motifs";

const externalLink = { target: "_blank", rel: "noopener noreferrer", "aria-describedby": "external-links-note" } as const;

function MotifScore() {
  const [selected, setSelected] = useState<MotifId>("recognition");
  const current = motifs[selected];
  const next = motifs[current.next];

  function randomStart() {
    // Only a reading choice. Excluding the current motif makes every press visible.
    const others = motifOrder.filter((id) => id !== selected);
    setSelected(others[Math.floor(Math.random() * others.length)]);
  }

  return (
    <section className="studies-score" id="score" aria-labelledby="score-title">
      <div className="score-heading">
        <div>
          <p className="studies-label">The score</p>
          <h2 id="score-title">Four motifs, one score.</h2>
          <p className="score-invitation">Choose a question. Follow a connection. Begin again.</p>
        </div>
        <button className="studies-button random-start" type="button" onClick={randomStart} aria-describedby="random-hint">
          <span aria-hidden="true">↗</span> Random start
        </button>
      </div>
      <p id="random-hint" className="studies-visually-hidden">
        Choose another motif, not a tax or account action. Your figures stay unchanged.
      </p>
      <div className="motif-score" role="group" aria-label="Choose a motif">
        {motifOrder.map((id) => (
          <button
            key={id}
            type="button"
            className="motif-button"
            aria-pressed={selected === id}
            aria-controls="motif-reading"
            onClick={() => setSelected(id)}
          >
            <span className="motif-numeral" aria-hidden="true">{motifs[id].numeral}</span>
            <span className="motif-name">{motifs[id].name}</span>
            <span className="motif-cue" aria-hidden="true">{selected === id ? "Reading" : "Explore"}</span>
          </button>
        ))}
      </div>
      <div className="studies-visually-hidden" role="status" aria-live="polite" aria-atomic="true">
        {current.name} selected. {current.question} Next connection: {next.name}.
      </div>
      <section className="motif-reading" id="motif-reading" aria-labelledby="motif-title">
        <div className="motif-text">
          <h3 className="studies-label" id="motif-title">{current.name}</h3>
          <p className="motif-question">{current.question}</p>
          <p className="motif-thought">{current.thought}</p>
        </div>
        <div className="motif-in-study">
          <p className="studies-label">In the working study</p>
          <p>{current.inStudy}</p>
          <a className="studies-text-link" href="#vat-comparison">Read it in the VAT study <span aria-hidden="true">↓</span></a>
        </div>
        <div className="motif-connection">
          <p id="connection-reason">{current.connection}</p>
          <button className="studies-button" type="button" onClick={() => setSelected(current.next)} aria-controls="motif-reading" aria-describedby="connection-reason">
            Follow to {next.name} <span aria-hidden="true">→</span>
          </button>
        </div>
      </section>
      <p className="score-footnote">A reading order, not a decision engine. The decision stays yours.</p>
    </section>
  );
}

export function StudiesApp() {
  return (
    <div className="studies">
      <a className="studies-skip" href="#studies-main">Skip to the study</a>
      <header className="studies-masthead studies-width">
        <a {...externalLink} className="studies-wordmark" href="https://taxsorted.io/" aria-label="TaxSorted home">TaxSorted<span>Studies</span></a>
        <nav aria-label="On this page">
          <a href="#score">The score</a>
          <a href="#vat-comparison">The study</a>
        </nav>
      </header>
      <main className="studies-width" id="studies-main" tabIndex={-1}>
        <section className="studies-opening" aria-labelledby="studies-title">
          <div>
            <p className="studies-label">A small, public study</p>
            <h1 id="studies-title">One set of facts.<br />Four ways of looking.</h1>
            <p className="studies-aim">The aim is the least lawful tax and the least avoidable burden. The work begins with attention, not a promise of savings.</p>
          </div>
          <aside className="studies-margin" aria-label="About the composition">
            <p className="studies-label">A recurring theme</p>
            <p>Recognise what applies.<br />Give it its time.<br />Look at the alternatives.<br />Leave room to put things right.</p>
            <p className="studies-margin-note">Four questions that return, rather than four steps to a guaranteed answer.</p>
          </aside>
        </section>

        <MotifScore />

        <div className="studies-working">
          <div className="studies-study-heading">
            <p className="studies-label">Study 01 <span aria-hidden="true">/</span> United Kingdom</p>
            <p>One completed quarter. The same records, read two ways.</p>
          </div>
          <aside className="studies-limits" role="note" aria-label="Study limits">
            <p><strong>A historical model, not admitted for current advice.</strong> It does not establish eligibility, a switching opportunity or a future saving.</p>
            <p>The composition can recur; tax rules are not timeless. Keep dates with the records, rules and evidence. The working study below shows the period and model assumptions.</p>
          </aside>
          <div className="studies-vat">
            <VatComparisonClient standalone />
          </div>
        </div>
      </main>
      <footer className="studies-footer studies-width">
        <div className="studies-footer-top">
          <p className="studies-coda">Return to the facts.<br />Leave room for a better question.</p>
          <nav aria-label="Public entrances">
            <a {...externalLink} href="https://taxsorted.io/">TaxSorted</a>
            <a {...externalLink} href="https://github.com/cambridgetcg/taxsorted-studies">Public source <span aria-hidden="true">↗</span></a>
          </nav>
        </div>
        <div className="studies-footer-notes">
          <p><strong>Historical model only.</strong> Not current tax advice, a return, a scheme election or a refund claim. Sources are not admitted for advice. Eligibility and action windows remain unassessed.</p>
          <p><strong>Private by design, within this page.</strong> This page does not store or send your figures. No accounts, analytics or remote fonts. Reloading clears the study. The hosting provider may keep access logs; following an external link leaves this page.</p>
        </div>
        <p id="external-links-note" className="studies-visually-hidden">External links open in new tabs.</p>
        <p className="studies-attribution">
          <span>TaxSorted (taxsorted.io) · TaxSorted contributors.</span>
          <span>Code: <a {...externalLink} href="https://www.gnu.org/licenses/agpl-3.0.html">AGPL-3.0</a>.</span>
          <span>Authored copy: <a {...externalLink} href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>.</span>
        </p>
      </footer>
    </div>
  );
}
