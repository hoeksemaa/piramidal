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

export const STRIP_H = 14; // CSS px: the strip under the time axis that holds the bar

// The 10 s that the latest model answer covers: dark lines at its start and end across all the
// traces, and a bar colored by its severity under the time axis. The lines skip the axis row, so
// they do not cross the time labels. It scrolls left with the EEG, then jumps right by stepS (2 s)
// when the next answer arrives. Only its position changes per frame, through a ref.
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
    <div ref={ref} className="model-window">
      <div className="model-window-edges" style={{ bottom: AXIS_H + STRIP_H }} />
      <div className="model-window-bar" style={{ height: STRIP_H }}>
        <div style={{ background: color }} />
      </div>
    </div>
  );
}
