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
            23 beds of real pediatric EEG, replayed in real time. Each bed shows
            its last 10 s and a status light. During a seizure, the light is
            red, and the bed gets a flashing red border and a SEIZURE tag.
            Click a bed to open its full view.
          </p>
          <p>
            In the full view, two dark lines mark the 10 s that the latest
            answer read. A blue band marks each seizure, from its onset to its
            end. On the right, the pattern burden shows the share of the last 3
            min in each class, from no seizure to seizure.
          </p>
        </section>

        <section>
          <h2>Status light</h2>
          <p>
            Red means that a seizure is going on, by the seizure rule below.
            Otherwise, the light shows the latest model answer. A new answer
            comes every 2 s and reads the last 10 s.
          </p>
          <ul className="legend">
            <li>
              <span className="light seizure" /> Seizure going on
            </li>
            <li>
              <span className="light pattern" /> Concerning: an IIC pattern
              (LPD, GPD, LRDA, GRDA), or one seizure call with P(SZ) ≥ 0.9
            </li>
            <li>
              <span className="light ok" /> Other, or a seizure call below 0.9
            </li>
          </ul>
        </section>

        <section>
          <h2>Seizure rule</h2>
          <p>
            A seizure is an event, not one answer. The rule follows the
            clinical reading:
          </p>
          <p>
            <b>Start:</b> 2 red answers in a row. A real seizure lasts at least
            10 s, so it shows in 2 overlapping windows. A lone red answer is
            usually flicker at the 0.9 cut.
          </p>
          <p>
            <b>End:</b> 5 answers in a row that are not red, about 10 s of
            non-seizure EEG. A shorter dip is the same seizure.
          </p>
          <p>
            <b>Onset ≈</b> the start of the first red window. Clinicians date a
            seizure from its first EEG change, not from the time they see it.{" "}
            <b>End ≈</b> the end of the last red window.
          </p>
          <p>
            On a test set of 23 clips with one seizure each, the rule finds 22
            seizures, a median 10 s after the expert onset. Its onset estimate
            is a median 2 s early. The 0.9 cut comes from that test set.
          </p>
          <p>
            On the 23 random clips here, it finds all 3 labeled seizures. But
            it also makes 13 false events in 60 min of seizure-free EEG. The
            model was trained on adult ICU EEG, not on these children.
          </p>
        </section>

        <section>
          <h2>Model · SPaRCNet</h2>
          <p>
            An open classifier from the MGH Westover lab (Jing et al.,{" "}
            <i>Neurology</i> 2023). It reads 10 s of 16-channel EEG and gives 6
            classes: seizure, 4 ictal-interictal continuum patterns, or other. A
            new answer comes every 2 s.
          </p>
          <p>
            <b>Why:</b> it is open, small (4 MB), and fast on a laptop. Its
            classes are the ICU&apos;s own terms. It stands in for a production
            model.
          </p>
          <p className="source">
            Source: weights <code>model_1130.pt</code> from{" "}
            <a
              href="https://github.com/bdsp-core/IIIC-SPaRCNet/blob/main/SPaRCNet/model_1130.pt"
              target="_blank"
              rel="noopener noreferrer"
            >
              github.com/bdsp-core/IIIC-SPaRCNet
            </a>
            . Paper:{" "}
            <a
              href="https://doi.org/10.1212/WNL.0000000000207127"
              target="_blank"
              rel="noopener noreferrer"
            >
              doi:10.1212/WNL.0000000000207127
            </a>
            .
          </p>
        </section>

        <section>
          <h2>Data · CHB-MIT</h2>
          <p>
            Scalp EEG from 23 children and young adults at Boston
            Children&apos;s Hospital (PhysioNet). Each bed plays a random 3
            minutes of that patient&apos;s recordings, as on a real ward. 3 of
            the 23 clips hold an expert-labeled seizure.
          </p>
          <p>
            <b>Why:</b> it is open, has expert seizure labels, and uses the same
            16 bipolar channels as the model.
          </p>
          <p className="source">
            Source:{" "}
            <a
              href="https://physionet.org/content/chbmit/1.0.0/"
              target="_blank"
              rel="noopener noreferrer"
            >
              physionet.org/content/chbmit/1.0.0
            </a>
            ; EEG files through its AWS mirror,{" "}
            <code>s3://physionet-open/chbmit/1.0.0</code>. License: ODC-By 1.0.
          </p>
        </section>

        <p className="note">
          Model outputs are computed in advance and replayed in step with the
          EEG. Not for clinical use.
        </p>
      </div>
    </aside>
  );
}
