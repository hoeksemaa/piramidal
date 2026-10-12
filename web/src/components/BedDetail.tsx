"use client";

import { useEffect } from "react";
import { SEVERITY_COLORS, answerLabel, severity } from "@/lib/status";
import { AXIS_H, EegChart } from "./EegChart";
import { ModelWindow, STRIP_H } from "./ModelWindow";
import { StatusLight } from "./StatusLight";

const WINDOW_S = 20;

type Props = {
  bed: number;
  name: string;
  info: string; // sex and age, e.g. "F, 11 y"; empty if the dataset does not list them
  data: Int16Array;
  probs: number[][];
  classes: string[];
  k: number;
  stepS: number;
  probWindowS: number;
  channels: string[];
  t0: number;
  fs: number;
  axisStartS: number; // time of clip sample 0 on the axis, in seconds after midnight
  axisPrefix: string;
  onClose: () => void;
};

// One bed, opened over the wall: the last 20 s of EEG with channel names, a time axis, and the
// latest model answer's 10 s window, still live.
export function BedDetail({ bed, name, info, data, probs, classes, k, stepS, probWindowS, channels, t0, fs, axisStartS, axisPrefix, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // The backdrop covers the wall: it blocks every click behind it, and a click on it closes the bed.
  return (
    <div className="backdrop" onClick={onClose}>
      <section className="detail" role="dialog" aria-modal="true" aria-label={`Bed ${bed}, ${name}`} onClick={(e) => e.stopPropagation()}>
        <header>
          <b>Bed {bed}</b>
          <span className="name">{name}</span>
          <span>{info || "sex and age not listed"}</span>
          <StatusLight probs={probs} k={k} classes={classes} />
          <span>{answerLabel(probs[k], classes)}</span>
          <button className="close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="detail-body">
          <div className="channels-col">
            <ol className="channels" style={{ paddingBottom: AXIS_H + STRIP_H }}>
              {channels.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ol>
            <span className="axis-unit" style={{ height: AXIS_H }}>
              seconds
            </span>
          </div>
          <EegChart
            data={data}
            t0={t0}
            fs={fs}
            nCh={channels.length}
            windowS={WINDOW_S}
            lineWidth={1}
            uvPerLane={400}
            axisStartS={axisStartS}
            axisPrefix={axisPrefix}
            stripH={STRIP_H}
          >
            <ModelWindow
              t0={t0}
              fs={fs}
              windowS={WINDOW_S}
              probWindowS={probWindowS}
              stepS={stepS}
              color={SEVERITY_COLORS[severity(probs[k], classes) - 1]}
            />
          </EegChart>
        </div>
      </section>
    </div>
  );
}
