"use client";

import { useEffect, useMemo, useRef } from "react";
import { hms, sampleAt } from "@/lib/playback";
import type { SeizureEvent } from "@/lib/status";
import { AXIS_H } from "./EegChart";
import { STRIP_H } from "./ModelWindow";

type Props = {
  events: SeizureEvent[];
  t0: number;
  fs: number;
  windowS: number; // seconds across the chart under these marks
  clipS: number; // clip length; the clip loops
  stepS: number; // seconds between model answers
  axisStartS: number; // time of clip sample 0 on the axis
  axisPrefix: string;
};

// Seizure events on the bed view, in the style of Marcy's onset marker: a light blue band over the
// EEG that the red answers read, a blue line under it, and two tags. "Seizure onset ≈" sits at the
// band's start; "Detected" sits where the first red answer arrived, one model window later.
// While the seizure goes on, the band ends at the latest answer. Only positions change per frame.
export function SeizureMarks({ events, t0, fs, windowS, clipS, stepS, axisStartS, axisPrefix }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  // Each event twice: in this loop of the clip, and in the last loop (seen just after the clip restarts).
  const marks = useMemo(() => events.flatMap((e) => [-1, 0].map((loop) => ({ e, loop }))), [events]);
  const clock = (s: number) => axisPrefix + hms(axisStartS + s);

  useEffect(() => {
    const root = rootRef.current!;
    const els = [...root.children] as HTMLElement[];
    const cw = root.clientWidth;
    const pxPerS = cw / windowS;
    els.forEach((el, i) => {
      const { e } = marks[i];
      el.querySelector<HTMLElement>(".seizure-detect")!.style.left = `${(e.detectS - e.onsetS) * pxPerS}px`;
    });
    let raf = 0;
    const frame = (now: number) => {
      const t = sampleAt(now, t0, fs) / fs; // seconds since clip start, not wrapped
      const loopStart = Math.floor(t / clipS) * clipS;
      const latest = Math.floor(t / stepS) * stepS; // when the latest answer arrived
      const xOf = (s: number) => cw - 2 - (t - s) * pxPerS; // the newest sample is 2 px inside the edge
      els.forEach((el, i) => {
        const { e, loop } = marks[i];
        const base = loopStart + loop * clipS;
        const x0 = xOf(base + e.onsetS);
        const x1 = xOf(Math.min(base + e.endS, latest));
        // Hidden until the first red answer arrives, and after the band leaves the chart.
        const show = base + e.detectS <= t && x1 > 0;
        el.style.display = show ? "block" : "none";
        if (show) {
          el.style.transform = `translateX(${x0}px)`;
          el.style.width = `${x1 - x0}px`;
        }
      });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [marks, t0, fs, windowS, clipS, stepS]);

  return (
    <div ref={rootRef} className="seizure-marks" style={{ bottom: AXIS_H + STRIP_H }}>
      {marks.map(({ e, loop }) => (
        <div key={`${e.first}:${loop}`} className="seizure-mark">
          <div className="seizure-tag seizure-onset-tag">
            <span className="seizure-dot" />
            <span>Seizure onset ≈ {clock(e.onsetS)}</span>
          </div>
          <div className="seizure-detect">
            <div className="seizure-tag seizure-detect-tag">
              <span>Detected {clock(e.detectS)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
