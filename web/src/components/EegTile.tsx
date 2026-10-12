"use client";

import { useEffect, useRef } from "react";

const SWEEP_S = 10; // seconds of EEG across the tile width
const UV_PER_LANE = 200; // each channel lane spans this many microvolts
const GAP_PX = 6; // blank gap ahead of the sweep cursor

type Props = { url: string; label: string; fs: number; nCh: number };

// Bedside-monitor sweep: each frame draws only the samples that arrived since the last frame.
export function EegTile({ url, label, fs, nCh }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    let cancelled = false;

    fetch(url)
      .then((r) => r.arrayBuffer())
      .then((buf) => {
        if (cancelled) return;
        const data = new Int16Array(buf); // sample-major: nCh values per sample, in uV
        const total = data.length / nCh;
        const dpr = window.devicePixelRatio || 1;
        const w = (canvas.width = Math.round(canvas.clientWidth * dpr));
        const h = (canvas.height = Math.round(canvas.clientHeight * dpr));
        const lane = h / nCh;
        const perSweep = fs * SWEEP_S;
        const gap = (GAP_PX * dpr * perSweep) / w; // the gap, in samples
        const xOf = (n: number) => ((n % perSweep) / perSweep) * w;
        // EEG convention: negative is up.
        const yOf = (n: number, c: number) => (c + 0.5) * lane + (data[(n % total) * nCh + c] * lane) / UV_PER_LANE;

        // Clear the pixels for samples [a, b), wrapping at the right edge.
        const erase = (a: number, b: number) => {
          const xa = Math.floor(xOf(a));
          const xb = Math.ceil(xOf(b));
          if (xb >= xa) ctx.clearRect(xa, 0, xb - xa, h);
          else {
            ctx.clearRect(xa, 0, w - xa, h);
            ctx.clearRect(0, 0, xb, h);
          }
        };

        ctx.strokeStyle = "#8fd694";
        ctx.lineWidth = dpr;
        const t0 = performance.now();
        let last = 0; // newest sample already drawn

        const frame = (now: number) => {
          const target = Math.floor(((now - t0) / 1000) * fs);
          if (target - last >= perSweep) {
            // The tab was hidden: start a fresh sweep at the current time.
            ctx.clearRect(0, 0, w, h);
            last = target;
          }
          if (target > last) {
            erase(last + gap, target + gap);
            ctx.beginPath();
            for (let c = 0; c < nCh; c++) {
              ctx.moveTo(xOf(last), yOf(last, c));
              for (let n = last + 1; n <= target; n++) {
                if (n % perSweep === 0) ctx.moveTo(0, yOf(n, c));
                else ctx.lineTo(xOf(n), yOf(n, c));
              }
            }
            ctx.stroke();
            last = target;
          }
          raf = requestAnimationFrame(frame);
        };
        raf = requestAnimationFrame(frame);
      });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [url, fs, nCh]);

  return (
    <div className="tile">
      <canvas ref={canvasRef} />
      <span>{label}</span>
    </div>
  );
}
