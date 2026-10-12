"use client";

import { useEffect, useRef, useState } from "react";

const WINDOW_S = 10; // seconds of EEG across the tile width; the newest sample is at the right edge
const UV_PER_LANE = 200; // each channel lane spans this many microvolts
const TRACE = "#3a3533"; // trace ink sampled from the Marcy video
// Red needs a confident, sustained seizure call. On our 23 clips, a plain top-class SZ call
// is red for 67% of non-seizure answers; this rule is red for 6% and still catches 21 of 23.
const RED_P = 0.9;
const RED_RUN = 3; // answers in a row (6 s)

type Props = {
  bed: number; // the bed's ID on the all-beds screen
  data: Int16Array; // sample-major: nCh values per sample, in uV
  probs: number[][]; // model output: probs[k] covers clip time [k * stepS - 10, k * stepS) s
  classes: string[];
  stepS: number;
  t0: number; // performance.now() at clip time 0, shared by all tiles
  fs: number;
  nCh: number;
};

const argmax = (p: number[]) => p.indexOf(Math.max(...p));

// Red: P(SZ) >= RED_P in the last RED_RUN answers.
// Yellow: the top class is one of the 4 IIC patterns, or P(SZ) >= RED_P but not yet for RED_RUN answers.
// Green: anything else, including weak seizure calls (60% of non-seizure answers on our clips).
function status(probs: number[][], k: number, classes: string[]) {
  const sz = classes.indexOf("SZ");
  const recent = probs.slice(Math.max(k - RED_RUN + 1, 0), k + 1);
  if (recent.length === RED_RUN && recent.every((p) => p[sz] >= RED_P)) return "seizure";
  const top = classes[argmax(probs[k])];
  return probs[k][sz] >= RED_P || (top !== "Other" && top !== "SZ") ? "pattern" : "ok";
}

// Scrolling strip chart: new samples enter at the right edge and move left. Each frame
// shifts the old pixels left by whole pixels, then draws only the new samples.
export function EegTile({ bed, data, probs, classes, stepS, t0, fs, nCh }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // The latest model answer at the playback time. It changes every stepS seconds, so
  // only the status light goes through React; the EEG drawing does not.
  const [k, setK] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const total = data.length / nCh;
    const dpr = window.devicePixelRatio || 1;
    const w = (canvas.width = Math.round(canvas.clientWidth * dpr));
    const h = (canvas.height = Math.round(canvas.clientHeight * dpr));
    const lane = h / nCh;
    const perWindow = fs * WINDOW_S;
    const pps = w / perWindow; // pixels per sample
    // EEG convention: negative is up.
    const yOf = (n: number, c: number) => (c + 0.5) * lane + (data[(n % total) * nCh + c] * lane) / UV_PER_LANE;

    let last = -1; // newest sample already drawn (-1: none yet)
    let lastK = -1;
    let raf = 0;

    const frame = (now: number) => {
      // Start one window into the clip, so the tile is full on the first frame.
      const target = perWindow + Math.floor(((now - t0) / 1000) * fs);
      const kNow = Math.min(Math.floor((target % total) / fs / stepS), probs.length - 1);
      if (kNow !== lastK) setK((lastK = kNow));
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
        ctx.lineWidth = 0.75 * dpr;
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
  }, [data, probs, stepS, t0, fs, nCh]);

  const p = probs[k];
  const top = argmax(p);
  const label = `${classes[top]} ${p[top].toFixed(2)} · SZ ${p[classes.indexOf("SZ")].toFixed(2)}`;
  return (
    <section className="tile">
      <header>
        <b>Bed {bed}</b>
        <span className={`light ${status(probs, k, classes)}`} title={label} role="img" aria-label={label} />
      </header>
      <div className="plot">
        <canvas ref={canvasRef} />
      </div>
    </section>
  );
}
