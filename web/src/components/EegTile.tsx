"use client";

import type { KeyboardEvent } from "react";
import { EegChart } from "./EegChart";
import { StatusLight } from "./StatusLight";

const WINDOW_S = 10;

type Props = {
  bed: number; // the bed's ID on the all-beds screen
  data: Int16Array;
  probs: number[][];
  classes: string[];
  k: number; // index of the latest model answer
  t0: number;
  fs: number;
  nCh: number;
  onOpen: () => void;
};

// One bed on the wall: a summary to draw attention (bed number, last 10 s, model status).
// Click to open the bed, where the full details are.
export function EegTile({ bed, data, probs, classes, k, t0, fs, nCh, onOpen }: Props) {
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen();
    }
  };
  return (
    <section className="tile" role="button" tabIndex={0} aria-label={`Open bed ${bed}`} onClick={onOpen} onKeyDown={onKeyDown}>
      <header>
        <b>Bed {bed}</b>
        <StatusLight probs={probs} k={k} classes={classes} />
      </header>
      <EegChart data={data} t0={t0} fs={fs} nCh={nCh} windowS={WINDOW_S} />
    </section>
  );
}
