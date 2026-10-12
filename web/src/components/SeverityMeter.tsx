"use client";

import { useEffect, useMemo, useRef } from "react";
import { sampleAt } from "@/lib/playback";
import { MAX_SEVERITY, severity } from "@/lib/status";

// Segment colors, bottom to top: green, through yellow and orange, to red.
const COLORS = ["#3fa56b", "#9dbf3a", "#e3c21a", "#f0a020", "#ec7a2a", "#e5484d"];
const OFF = "#ebe8e6";
const SEG_H = 5; // CSS px
const SEG_GAP = 2;
const COL_GAP = 3; // between columns
const PAD = 4;
export const METER_H = 2 * PAD + MAX_SEVERITY * SEG_H + (MAX_SEVERITY - 1) * SEG_GAP;

type Props = {
  probs: number[][]; // probs[k] covers clip time [k * stepS - probWindowS, k * stepS) s
  classes: string[];
  stepS: number;
  probWindowS: number;
  windowS: number; // seconds across the width, the same as the EEG chart above
  t0: number;
  fs: number;
  clipSamples: number;
};

// A "volume meter" under the open bed's EEG: one column of 6 segments per stepS (2 s) of time,
// lit up to the highest severity among the model answers whose window covers that time.
// Each 2 s is covered by probWindowS / stepS (5) answers, so the newest columns can still rise
// as later answers arrive. Columns scroll in step with the EEG.
export function SeverityMeter({ probs, classes, stepS, probWindowS, windowS, t0, fs, clipSamples }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const levels = useMemo(() => probs.map((p) => severity(p, classes)), [probs, classes]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    const w = (canvas.width = Math.round(canvas.clientWidth * dpr));
    const h = (canvas.height = Math.round(canvas.clientHeight * dpr));
    const pps = w / (fs * windowS); // pixels per sample, as in EegChart
    const unit = stepS * fs; // samples per column
    const span = probWindowS / stepS; // answers that cover one column
    const answersPerLoop = clipSamples / unit;
    let raf = 0;

    const frame = (now: number) => {
      const target = sampleAt(now, t0, fs);
      const right = Math.floor(target * pps);
      const xOf = (n: number) => w - 2 * dpr - (right - n * pps); // the same mapping as EegChart
      const kNow = Math.floor(target / unit); // newest answer so far (not wrapped to the clip)
      ctx.clearRect(0, 0, w, h);
      // Column u covers samples [u * unit, (u + 1) * unit) and answers u + 1 ... u + span.
      // The column for the current, unfinished 2 s has no answer yet, so start one before it.
      for (let u = kNow - 1; u >= 0; u--) {
        const x0 = xOf(u * unit) + COL_GAP * dpr;
        const x1 = xOf((u + 1) * unit) - COL_GAP * dpr;
        if (x1 < 0) break;
        let level = 0;
        for (let k = u + 1; k <= Math.min(u + span, kNow); k++) level = Math.max(level, levels[k % answersPerLoop]);
        for (let s = 0; s < MAX_SEVERITY; s++) {
          ctx.fillStyle = s < level ? COLORS[s] : OFF;
          const y = h - (PAD + (s + 1) * SEG_H + s * SEG_GAP) * dpr;
          ctx.fillRect(x0, y, x1 - x0, SEG_H * dpr);
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [levels, stepS, probWindowS, windowS, t0, fs, clipSamples]);

  return (
    <div className="meter" style={{ height: METER_H }}>
      <canvas ref={canvasRef} />
    </div>
  );
}
