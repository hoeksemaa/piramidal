"use client";

import { useEffect, useMemo, useRef } from "react";
import { hms, sampleAt } from "@/lib/playback";
import type { SeizureEvent } from "@/lib/status";
import { AXIS_H } from "./EegChart";
import { STRIP_H } from "./ModelWindow";

const EASE_S = 0.6; // seconds for the band to settle on the estimated end

type Props = {
  events: SeizureEvent[];
  t0: number;
  fs: number;
  windowS: number; // seconds across the chart under these marks
  clipS: number; // clip length; the clip loops
  axisStartS: number; // time of clip sample 0 on the axis
  axisPrefix: string;
};

// Seizure events on the bed view, in the style of Marcy's onset marker: a light blue band with a
// blue line under it, a dot and "Seizure onset ≈" tag at its start, and a dashed "Detected" line.
// While the seizure goes on, the band runs to the live edge, as in Marcy's video. When the end is
// known, the band eases back to the estimated end, and an "Ended ≈" tag shows there.
// Only positions change per frame, through the DOM.
export function SeizureMarks({ events, t0, fs, windowS, clipS, axisStartS, axisPrefix }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  // Each event twice: in this loop of the clip, and in the last loop (seen just after the clip restarts).
  const marks = useMemo(() => events.flatMap((e) => [-1, 0].map((loop) => ({ e, loop }))), [events]);
  const clock = (s: number) => axisPrefix + hms(axisStartS + s);

  useEffect(() => {
    const root = rootRef.current!;
    const els = [...root.children] as HTMLElement[];
    const ends = els.map((el) => el.querySelector<HTMLElement>(".seizure-end")); // none if the clip cut it off
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
      const xOf = (s: number) => cw - 2 - (t - s) * pxPerS; // the newest sample is 2 px inside the edge
      els.forEach((el, i) => {
        const { e, loop } = marks[i];
        const base = loopStart + loop * clipS;
        const ended = base + Math.min(e.endedS, clipS); // a seizure still going at the clip's end ends there
        const end = base + e.endS;
        let right = t; // still going: the band runs to the live edge
        if (t >= ended) {
          const u = Math.min((t - ended) / EASE_S, 1);
          right = ended - (ended - end) * (1 - (1 - u) ** 3); // ease out, from the live edge to the end
        }
        const x0 = xOf(base + e.onsetS);
        const x1 = xOf(right);
        // Hidden until the event is detected, and after the band leaves the chart.
        const show = base + e.detectS <= t && x1 > 0;
        el.style.display = show ? "block" : "none";
        if (show) {
          el.style.transform = `translateX(${x0}px)`;
          el.style.width = `${x1 - x0}px`;
          if (ends[i]) ends[i].style.display = t >= ended + EASE_S ? "block" : "none";
        }
      });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [marks, t0, fs, windowS, clipS]);

  return (
    <div ref={rootRef} className="seizure-marks" style={{ bottom: AXIS_H + STRIP_H }}>
      {marks.map(({ e, loop }) => (
        <div key={`${e.detectK}:${loop}`} className="seizure-mark">
          <div className="seizure-tag seizure-onset-tag">
            <span className="seizure-dot" />
            <span>Seizure onset ≈ {clock(e.onsetS)}</span>
          </div>
          <div className="seizure-detect">
            <div className="seizure-tag seizure-detect-tag">
              <span>Detected {clock(e.detectS)}</span>
            </div>
          </div>
          {e.endedS <= clipS && (
            <div className="seizure-end">
              <div className="seizure-tag seizure-end-tag">
                <span>Ended ≈ {clock(e.endS)}</span>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
