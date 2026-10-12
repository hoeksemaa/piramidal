import { useMemo } from "react";
import { SEVERITY_COLORS, SEVERITY_ORDER, answerClass } from "@/lib/status";

type Props = {
  probs: number[][];
  classes: string[];
  k: number; // index of the latest model answer
  looped: boolean; // the clip has played through once, so the last 3 min are all available
  stepS: number;
  clipS: number;
};

// Shown when the viewer hovers over (or tabs to) a class name.
const DESCRIPTIONS: Record<string, string> = {
  Other: "No IIC pattern and no confident seizure call. Includes seizure calls with P(SZ) below 0.9.",
  GRDA: "Generalized rhythmic delta activity: slow waves (below 4 Hz) that repeat without pause on both sides of the brain.",
  GPD: "Generalized periodic discharges: brief, often sharp discharges at regular intervals on both sides of the brain.",
  LRDA: "Lateralized rhythmic delta activity: slow waves (below 4 Hz) that repeat without pause, mainly on one side.",
  LPD: "Lateralized periodic discharges: brief, often sharp discharges at regular intervals, mainly on one side. The IIC pattern most linked to seizures.",
  SZ: "Seizure: a confident seizure call, P(SZ) ≥ 0.9.",
};

/** Seconds -> "m:ss". */
const mss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

// Pattern burden: how many recent model answers fall in each class, from no seizure (left) to
// seizure (right). Each answer is labeled with the light's per-answer rule (answerClass). The span
// is the last 3 min, all the EEG a bed has; until the clip has played once, it is the time since
// the clip's start. Bar heights use a fixed scale (the answers in 3 min), so the bars grow as the
// clip plays.
export function BurdenHistogram({ probs, classes, k, looped, stepS, clipS }: Props) {
  const full = Math.min(probs.length, Math.round(clipS / stepS)); // answers in 3 min
  const answers = looped ? full : k + 1;
  const counts = useMemo(() => {
    const n = Object.fromEntries(SEVERITY_ORDER.map((c) => [c, 0]));
    for (const p of probs.slice(0, answers)) n[answerClass(p, classes)]++;
    return SEVERITY_ORDER.map((c) => n[c]);
  }, [probs, classes, answers]);

  return (
    <figure className="card burden">
      <figcaption>
        <b>Pattern burden</b>
        <span>
          Model answers in the last {mss(answers * stepS)}, one every {stepS} s
        </span>
      </figcaption>
      <div className="burden-bars">
        {SEVERITY_ORDER.map((c, i) => (
          <div key={c} className="burden-col">
            <div className="burden-bar" style={{ height: `${(100 * counts[i]) / full}%`, background: SEVERITY_COLORS[i] }} />
            <span className="burden-count" style={{ bottom: `${(100 * counts[i]) / full}%` }}>
              {counts[i]}
            </span>
          </div>
        ))}
      </div>
      <div className="burden-labels">
        {SEVERITY_ORDER.map((c) => (
          <span key={c} className="burden-label" tabIndex={0}>
            {c}
            <span className="burden-tip" role="tooltip">
              {DESCRIPTIONS[c]}
            </span>
          </span>
        ))}
      </div>
    </figure>
  );
}
