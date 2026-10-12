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
            its last 10 s and a model status light. Click a bed to open its full
            view.
          </p>
          <p>
            In the full view, two dark lines mark the 10 s that the latest
            answer read. A blue band marks EEG that the model called a seizure.
          </p>
        </section>

        <section>
          <h2>Status light</h2>
          <p>
            The light shows the latest model answer, 1:1. A new answer comes
            every 2 s and reads the last 10 s.
          </p>
          <ul className="legend">
            <li>
              <span className="light ok" /> Other, or a seizure call below 0.9
            </li>
            <li>
              <span className="light pattern" /> Concerning pattern (LPD, GPD,
              LRDA, GRDA)
            </li>
            <li>
              <span className="light seizure" /> Seizure: P(SZ) ≥ 0.9
            </li>
          </ul>
        </section>

        <section>
          <h2>Seizure onset</h2>
          <p>
            A red answer says that a seizure is somewhere in its 10 s.
            Clinicians date a seizure from its first EEG change, not from the
            time they see it. Thus the onset tag goes at the start of the first
            red window, 10 s before the detection tag. On our clips, that start
            is a median 2 s before the expert label.
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
            Children&apos;s Hospital (PhysioNet). Each bed plays one 3-minute
            clip with one expert-labeled seizure.
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
