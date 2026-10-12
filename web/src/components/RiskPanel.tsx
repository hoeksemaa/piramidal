"use client";

import { useLayoutEffect, useRef } from "react";
import type { Status } from "@/lib/status";

export type RiskRow = {
  bed: number;
  name: string;
  status: Status;
  word: string; // the status in one word, as on the bed view's status card
  color: string;
  score: number; // demo risk score, 0-100
};

type Props = {
  rows: RiskRow[]; // in rank order
  span: string; // the time the scores cover, "m:ss"
  onOpen: (bed: number) => void;
};

// The wall's right quarter: every bed, ranked live. Beds in a seizure come first and flash red;
// the rest follow by risk score. A click on a row opens that bed. When the order changes, each
// row slides from its old place to its new one, so the eye can follow a bed.
export function RiskPanel({ rows, span, onOpen }: Props) {
  const items = useRef(new Map<number, HTMLLIElement>());
  const lastTop = useRef(new Map<number, number>());

  useLayoutEffect(() => {
    items.current.forEach((el, bed) => {
      const top = el.offsetTop;
      const before = lastTop.current.get(bed);
      lastTop.current.set(bed, top);
      if (before === undefined || before === top) return;
      el.style.transition = "none";
      el.style.transform = `translateY(${before - top}px)`;
      requestAnimationFrame(() => {
        el.style.transition = "transform 0.5s ease";
        el.style.transform = "";
      });
    });
  });

  return (
    <aside className="card risk" aria-label="Beds ranked by risk">
      <header>
        <b>Risk ranking</b>
        <span>Seizures first, then risk score (last {span})</span>
      </header>
      <div className="risk-cols" aria-hidden="true">
        <span>#</span>
        <span>Bed</span>
        <span>Now</span>
        <span>Risk</span>
      </div>
      <ol className="risk-list">
        {rows.map((r, i) => (
          <li
            key={r.bed}
            ref={(el) => {
              if (el) items.current.set(r.bed, el);
              else items.current.delete(r.bed);
            }}
            className={`risk-row${r.status === "seizure" ? " seizure" : ""}`}
          >
            <button onClick={() => onOpen(r.bed)} aria-label={`Open bed ${r.bed}, ${r.name}: ${r.word}, risk ${r.score}`}>
              <span className="risk-rank">{i + 1}</span>
              <span className="risk-bed">
                <b>Bed {r.bed}</b> {r.name}
              </span>
              <span className="risk-now">
                <i style={{ background: r.color }} />
                {r.word}
              </span>
              <span className="risk-value">{r.score}</span>
            </button>
          </li>
        ))}
      </ol>
    </aside>
  );
}
