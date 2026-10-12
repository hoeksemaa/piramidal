"use client";

import type { KeyboardEvent } from "react";
import type { Status } from "@/lib/status";
import { EegChart } from "./EegChart";
import { StatusLight } from "./StatusLight";

const WINDOW_S = 10;

type Props = {
  bed: number; // the bed's ID on the all-beds screen
  name: string;
  data: Int16Array;
  probs: number[][];
  classes: string[];
  k: number; // index of the latest model answer
  status: Status; // the bed status: red if and only if a seizure event is going on
  t0: number;
  fs: number;
  nCh: number;
  onOpen: () => void;
};

// One bed on the wall: a summary to draw attention (bed number and name, last 10 s, status). During a
// seizure event, a red border and a SEIZURE tag, as on Marcy's wall. Click to open the bed.
export function EegTile({ bed, name, data, probs, classes, k, status, t0, fs, nCh, onOpen }: Props) {
  const seizure = status === "seizure";
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen();
    }
  };
  return (
    <section
      className={`tile${seizure ? " seizure" : ""}`}
      role="button"
      tabIndex={0}
      aria-label={`Open bed ${bed}, ${name}${seizure ? ", seizure" : ""}`}
      onClick={onOpen}
      onKeyDown={onKeyDown}
    >
      <header>
        <span className="tile-title">
          <b>Bed {bed}</b> {name}
        </span>
        {seizure && <span className="seizure-flag">Seizure</span>}
        <StatusLight status={status} answer={probs[k]} classes={classes} />
      </header>
      <EegChart data={data} t0={t0} fs={fs} nCh={nCh} windowS={WINDOW_S} />
    </section>
  );
}
