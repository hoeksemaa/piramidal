"use client";

import { useEffect, useRef } from "react";
import { sampleAt } from "@/lib/playback";

const UV_PER_LANE = 200; // each channel lane spans this many microvolts
const TRACE = "#3a3533"; // trace ink sampled from the Marcy video

type Props = {
  data: Int16Array; // sample-major: nCh values per sample, in uV
  t0: number; // performance.now() at playback start, shared by all charts
  fs: number;
  nCh: number;
  windowS: number; // seconds of EEG across the chart width; the newest sample is at the right edge
  lineWidth?: number; // CSS px
};

// Scrolling strip chart: new samples enter at the right edge and move left. Each frame
// shifts the old pixels left by whole pixels, then draws only the new samples.
export function EegChart({ data, t0, fs, nCh, windowS, lineWidth = 0.75 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const total = data.length / nCh;
    const dpr = window.devicePixelRatio || 1;
    const w = (canvas.width = Math.round(canvas.clientWidth * dpr));
    const h = (canvas.height = Math.round(canvas.clientHeight * dpr));
    const lane = h / nCh;
    const perWindow = fs * windowS;
    const pps = w / perWindow; // pixels per sample
    // EEG convention: negative is up.
    const yOf = (n: number, c: number) => (c + 0.5) * lane + (data[(n % total) * nCh + c] * lane) / UV_PER_LANE;

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
        ctx.strokeStyle = TRACE;
        ctx.lineWidth = lineWidth * dpr;
        ctx.lineJoin = "round"; // miter joins spike on dense zigzags
        ctx.beginPath();
        for (let c = 0; c < nCh; c++) {
          ctx.moveTo(xOf(from), yOf(from, c));
          for (let n = from + 1; n <= target; n++) ctx.lineTo(xOf(n), yOf(n, c));
        }
        ctx.stroke();
        last = target;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => cancelAnimationFrame(raf);
  }, [data, t0, fs, nCh, windowS, lineWidth]);

  return (
    <div className="plot">
      <canvas ref={canvasRef} />
    </div>
  );
}
