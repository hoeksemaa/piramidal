"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { sampleAt } from "@/lib/playback";

const TRACE = "#3a3533"; // trace ink sampled from the Marcy video
const GRID = "#ebe8e6";
const MUTED = "#8a8685";
export const AXIS_H = 20; // CSS px at the bottom for the time axis

type Props = {
  data: Int16Array; // sample-major: nCh values per sample, in uV
  t0: number; // performance.now() at playback start, shared by all charts
  fs: number;
  nCh: number;
  windowS: number; // seconds of EEG across the chart width; the newest sample is at the right edge
  lineWidth?: number; // CSS px
  uvPerLane?: number; // each channel lane spans this many microvolts; higher squishes the traces
  axisStartS?: number; // if set, draw a time axis: the time of clip sample 0, in seconds after midnight
  axisPrefix?: string; // put before each axis label
  stripH?: number; // CSS px kept empty under the time axis, for overlays
  children?: ReactNode; // overlays on top of the traces
};

/** Seconds -> "HH:MM:SS", wrapped to one day. */
const hms = (s: number) => {
  const t = ((Math.floor(s) % 86400) + 86400) % 86400;
  return [Math.floor(t / 3600), Math.floor(t / 60) % 60, t % 60].map((v) => String(v).padStart(2, "0")).join(":");
};

// Scrolling strip chart: new samples enter at the right edge and move left. Each frame
// shifts the old pixels left by whole pixels, then draws only the new samples. The time
// axis and 1 s gridlines are drawn into the same image, so they scroll with the EEG.
export function EegChart({ data, t0, fs, nCh, windowS, lineWidth = 0.75, uvPerLane = 200, axisStartS, axisPrefix = "", stripH = 0, children }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const total = data.length / nCh;
    const dpr = window.devicePixelRatio || 1;
    const w = (canvas.width = Math.round(canvas.clientWidth * dpr));
    const h = (canvas.height = Math.round(canvas.clientHeight * dpr));
    const axis = axisStartS !== undefined;
    const axisH = axis ? AXIS_H * dpr : 0;
    // Top to bottom: the lanes, the time axis, then an empty strip for overlays.
    const axisTop = h - stripH * dpr - axisH;
    const lanesH = axisTop;
    const lane = lanesH / nCh;
    const perWindow = fs * windowS;
    const pps = w / perWindow; // pixels per sample
    // EEG convention: negative is up.
    const yOf = (n: number, c: number) => (c + 0.5) * lane + (data[(n % total) * nCh + c] * lane) / uvPerLane;
    // Label every 1, 2, 5, or 10 s: the first that leaves at least 80 CSS px between labels.
    const labelEvery = [1, 2, 5, 10].find((s) => (s * fs * pps) / dpr >= 80) ?? 10;
    const labelOf = (n: number) => axisPrefix + hms(axisStartS! + (n % total) / fs);
    const pending: number[] = []; // second marks whose label does not fit whole yet

    let last = -1; // newest sample already drawn (-1: none yet)
    let raf = 0;

    const frame = (now: number) => {
      const target = sampleAt(now, t0, fs);
      if (target > last) {
        const right = Math.floor(target * pps); // the right edge, in absolute pixels
        const shift = last < 0 ? w : right - Math.floor(last * pps);
        if (shift > 0) {
          // "copy" moves the image and leaves the uncovered right columns blank.
          ctx.globalCompositeOperation = "copy";
          ctx.drawImage(canvas, -shift, 0);
          ctx.globalCompositeOperation = "source-over";
        }
        // The newest sample sits 2 px inside the right edge, so no part of its stroke is clipped.
        const xOf = (n: number) => w - 2 * dpr - (right - n * pps);
        const from = Math.max(last, target - perWindow - 1, 0); // after a hidden tab, redraw one window

        if (axis) {
          // Gridline and tick at each new whole second, under this frame's traces.
          for (let n = Math.ceil((from + 1) / fs) * fs; n <= target; n += fs) {
            const x = Math.round(xOf(n));
            ctx.fillStyle = GRID;
            ctx.fillRect(x, 0, dpr, lanesH);
            ctx.fillStyle = MUTED;
            ctx.fillRect(x, axisTop, dpr, 4 * dpr);
            if ((n / fs) % labelEvery === 0) pending.push(n);
          }
        }

        ctx.strokeStyle = TRACE;
        ctx.lineWidth = lineWidth * dpr;
        ctx.lineJoin = "round"; // miter joins spike on dense zigzags
        ctx.beginPath();
        for (let c = 0; c < nCh; c++) {
          ctx.moveTo(xOf(from), yOf(from, c));
          for (let n = from + 1; n <= target; n++) ctx.lineTo(xOf(n), yOf(n, c));
        }
        ctx.stroke();

        if (axis) {
          // Each label is drawn once, centered on its tick, when it fits whole; then it scrolls.
          ctx.fillStyle = MUTED;
          ctx.font = `${11 * dpr}px system-ui, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          while (pending.length) {
            const text = labelOf(pending[0]);
            const x = xOf(pending[0]);
            if (x + ctx.measureText(text).width / 2 > w - 2 * dpr) break;
            ctx.fillText(text, x, axisTop + axisH / 2 + 2 * dpr);
            pending.shift();
          }
        }
        last = target;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => cancelAnimationFrame(raf);
  }, [data, t0, fs, nCh, windowS, lineWidth, uvPerLane, axisStartS, axisPrefix, stripH]);

  return (
    <div className="plot">
      <canvas ref={canvasRef} />
      {children}
    </div>
  );
}
