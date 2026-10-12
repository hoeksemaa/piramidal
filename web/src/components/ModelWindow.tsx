"use client";

import { useEffect, useRef } from "react";
import { sampleAt } from "@/lib/playback";
import { AXIS_H } from "./EegChart";

type Props = {
  t0: number;
  fs: number;
  windowS: number; // seconds across the chart under this band
  probWindowS: number; // seconds each model answer covers
  stepS: number; // seconds between model answers
  color: string; // severity color of the latest answer
};

export const STRIP_H = 14; // CSS px: the strip under the traces that holds the bar

// A bar under the traces for the 10 s that the latest model answer covers, colored by its severity,
// with dark lines at its start and end. It scrolls left with the EEG, then jumps right by stepS
// (2 s) when the next answer arrives. Only its position changes per frame, through a ref.
export function ModelWindow({ t0, fs, windowS, probWindowS, stepS, color }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current!;
    const pps = el.parentElement!.clientWidth / (fs * windowS); // CSS px per sample, as in EegChart
    el.style.width = `${probWindowS * fs * pps}px`;
    const unit = stepS * fs; // samples between answers
    let raf = 0;
    const frame = (now: number) => {
      const target = sampleAt(now, t0, fs);
      const sinceAnswer = target - Math.floor(target / unit) * unit; // samples since the latest answer
      el.style.transform = `translateX(${-sinceAnswer * pps}px)`;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [t0, fs, windowS, probWindowS, stepS]);

  return (
    <div ref={ref} className="model-window" style={{ bottom: AXIS_H, height: STRIP_H }}>
      <div style={{ background: color }} />
    </div>
  );
}
