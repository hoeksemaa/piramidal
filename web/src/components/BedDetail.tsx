"use client";

import { useEffect } from "react";
import { answerLabel } from "@/lib/status";
import { EegChart } from "./EegChart";
import { StatusLight } from "./StatusLight";

const WINDOW_S = 20;

type Props = {
  bed: number;
  data: Int16Array;
  probs: number[][];
  classes: string[];
  k: number;
  channels: string[];
  t0: number;
  fs: number;
  onClose: () => void;
};

// One bed, opened over the wall: the last 20 s of EEG with channel names, still live.
export function BedDetail({ bed, data, probs, classes, k, channels, t0, fs, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // The backdrop covers the wall: it blocks every click behind it, and a click on it closes the bed.
  return (
    <div className="backdrop" onClick={onClose}>
      <section className="detail" role="dialog" aria-modal="true" aria-label={`Bed ${bed}`} onClick={(e) => e.stopPropagation()}>
        <header>
          <b>Bed {bed}</b>
          <StatusLight probs={probs} k={k} classes={classes} />
          <span>{answerLabel(probs[k], classes)}</span>
          <span className="window">last {WINDOW_S} s</span>
          <button className="close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="detail-body">
          <ol className="channels">
            {channels.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ol>
          <EegChart data={data} t0={t0} fs={fs} nCh={channels.length} windowS={WINDOW_S} lineWidth={1} />
        </div>
      </section>
    </div>
  );
}
