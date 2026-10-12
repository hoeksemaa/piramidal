"use client";

import { useEffect, useRef, useState } from "react";

// Left side panel: says what this demo is, who made it, and which model and data it uses, and why.
// It starts closed; only an arrow button shows in the top-left corner. The panel slides over the
// wall, so the wall's charts keep their size. Any click outside the panel closes it, and that
// click still does its own job (a click on a bed also opens the bed).
export function Sidebar() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  return (
    <aside
      ref={ref}
      className={`sidebar${open ? " open" : ""}`}
      aria-label="About this demo"
    >
      <button
        className="sidebar-tab"
        aria-label={open ? "Close the about panel" : "Open the about panel"}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {open ? "‹" : "›"}
      </button>
      <div className="sidebar-body">
        <h1>Piramidal Demo</h1>
        <p className="byline">
          by{" "}
          <a
            href="https://johnhoeksema.com/"
            target="_blank"
            rel="noopener noreferrer"
          >
            John Hoeksema
          </a>
        </p>

        <section>
          <h2>What you see</h2>
          <p>
            23 beds of real pediatric EEG, replayed live, ranked by risk on the
            right. Click a bed or a row to open it.
          </p>
        </section>

        <section>
          <h2>Status light</h2>
          <p>The latest model answer: new every 2 s, reading the last 10 s.</p>
          <ul className="legend">
            <li>
              <span className="light seizure" /> Seizure going on
            </li>
            <li>
              <span className="light pattern" /> IIC pattern, or one seizure call
            </li>
            <li>
              <span className="light ok" /> Other
            </li>
          </ul>
        </section>

        <section>
          <h2>Seizure rule</h2>
          <p>
            Starts after 2 answers in a row with P(SZ) ≥ 0.9; ends after 5
            without. Onset ≈ the start of the first seizure window.
          </p>
          <p>
            Test set: 22 of 23 seizures found, a median 10 s late. Here: 3 of 3
            found, but 13 false alarms in 60 min.
          </p>
        </section>

        <section>
          <h2>Risk score</h2>
          <p>
            Mean severity of the last 3 min (Other 0, GRDA 1, GPD 2, LRDA 3,
            LPD 4, SZ 5), as 0–100.
          </p>
          <p>
            <b>Demo only, not validated.</b> A real score needs ICU EEG with
            expert labels and outcomes, as for 2HELPS2B.
          </p>
        </section>

        <section>
          <h2>Model · SPaRCNet</h2>
          <p>
            Open EEG classifier (MGH, <i>Neurology</i> 2023): seizure, 4 IIC
            patterns, or other. Small and fast; a stand-in for a production
            model.
          </p>
          <p className="source">
            <a
              href="https://github.com/bdsp-core/IIIC-SPaRCNet/blob/main/SPaRCNet/model_1130.pt"
              target="_blank"
              rel="noopener noreferrer"
            >
              Weights
            </a>{" "}
            ·{" "}
            <a
              href="https://doi.org/10.1212/WNL.0000000000207127"
              target="_blank"
              rel="noopener noreferrer"
            >
              Paper
            </a>
          </p>
        </section>

        <section>
          <h2>Data · CHB-MIT</h2>
          <p>
            Pediatric scalp EEG. One random 3 min per patient; 3 of 23 hold a
            labeled seizure.
          </p>
          <p className="source">
            <a
              href="https://physionet.org/content/chbmit/1.0.0/"
              target="_blank"
              rel="noopener noreferrer"
            >
              PhysioNet
            </a>
            , via <code>s3://physionet-open</code> · ODC-By 1.0
          </p>
        </section>

        <p className="note">Outputs computed in advance. Not for clinical use.</p>
      </div>
    </aside>
  );
}
