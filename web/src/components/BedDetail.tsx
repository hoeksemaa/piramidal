"use client";

import { useEffect } from "react";
import { hms } from "@/lib/playback";
import { SEVERITY_COLORS, answerLabel, bedStatus, ongoingEvent, severity, type SeizureEvent } from "@/lib/status";
import { BurdenHistogram } from "./BurdenHistogram";
import { AXIS_H, EegChart } from "./EegChart";
import { ModelWindow, STRIP_H } from "./ModelWindow";
import { SeizureMarks } from "./SeizureMarks";
import { StatusCard } from "./StatusCard";
import { StatusLight } from "./StatusLight";

const WINDOW_S = 20;

type Props = {
  bed: number;
  name: string;
  info: string; // sex and age, e.g. "F, 11 y"; empty if the dataset does not list them
  recording: string; // the source EDF file
  data: Int16Array;
  probs: number[][];
  classes: string[];
  events: SeizureEvent[];
  k: number;
  looped: boolean; // the clip has played through once
  stepS: number;
  probWindowS: number;
  channels: string[];
  t0: number;
  fs: number;
  axisStartS: number; // time of clip sample 0 on the axis, in seconds after midnight
  axisPrefix: string;
  onClose: () => void;
};

// One bed, opened over the wall, still live. Left three quarters: the last 20 s of EEG with channel
// names, a time axis, the latest model answer's 10 s window, and seizure events. Right quarter:
// three cards: the patient, the status now, and the pattern burden.
export function BedDetail({ bed, name, info, recording, data, probs, classes, events, k, looped, stepS, probWindowS, channels, t0, fs, axisStartS, axisPrefix, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const ongoing = ongoingEvent(events, k);
  const status = bedStatus(events, probs[k], k, classes);
  const clock = (s: number) => axisPrefix + hms(axisStartS + s);
  const clipS = data.length / channels.length / fs;

  // The backdrop covers the wall: it blocks every click behind it, and a click on it closes the bed.
  return (
    <div className="backdrop" onClick={onClose}>
      <section className="detail" role="dialog" aria-modal="true" aria-label={`Bed ${bed}, ${name}`} onClick={(e) => e.stopPropagation()}>
        <div className="detail-main">
          <header>
            <b>Bed {bed}</b>
            <StatusLight status={status} answer={probs[k]} classes={classes} />
            <span>{answerLabel(probs[k], classes)}</span>
          </header>
          <div className="detail-body">
            <div className="channels-col">
              <ol className="channels" style={{ paddingBottom: AXIS_H + STRIP_H }}>
                {channels.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ol>
              <span className="axis-unit" style={{ height: AXIS_H, bottom: STRIP_H }}>
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
              <SeizureMarks
                events={events}
                t0={t0}
                fs={fs}
                windowS={WINDOW_S}
                clipS={clipS}
                axisStartS={axisStartS}
                axisPrefix={axisPrefix}
              />
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
        </div>
        <aside className="detail-side">
          <section className="card patient">
            <h2>{name}</h2>
            <p>{info || "sex and age not listed"}</p>
            <dl>
              <dt>Bed</dt>
              <dd>{bed}</dd>
              <dt>Recording</dt>
              <dd>{recording}</dd>
              <dt>Clip start</dt>
              <dd>{clock(0)}</dd>
            </dl>
          </section>
          <StatusCard status={status} answer={probs[k]} classes={classes} ongoing={ongoing} clock={clock} />
          <BurdenHistogram probs={probs} classes={classes} k={k} looped={looped} stepS={stepS} clipS={clipS} />
        </aside>
        <button className="close" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </section>
    </div>
  );
}
