import { useMemo } from "react";
import { mss } from "@/lib/playback";
import { SEVERITY_COLORS, SEVERITY_ORDER, classCounts, recentCount, riskScore } from "@/lib/status";

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

// Pattern burden: how many recent model answers fall in each class, from no seizure (left) to
// seizure (right). Each answer is labeled with the light's per-answer rule (answerClass). The span
// is the last 3 min, all the EEG a bed has; until the clip has played once, it is the time since
// the clip's start. Bar heights use a fixed scale (the answers in 3 min), so the bars grow as the
// clip plays. The demo risk score (riskScore) comes from the same counts.
export function BurdenHistogram({ probs, classes, k, looped, stepS, clipS }: Props) {
  const full = recentCount(probs.length, 0, true, clipS, stepS); // answers in 3 min
  const answers = recentCount(probs.length, k, looped, clipS, stepS);
  const counts = useMemo(() => classCounts(probs, classes, answers), [probs, classes, answers]);

  return (
    <figure className="card burden">
      <figcaption>
        <b>Pattern burden</b>
        <span className="risk-score" title="Demo risk score, 0-100">
          Risk <b>{riskScore(counts)}</b>
        </span>
        <span className="burden-span">Model answers, last {mss(answers * stepS)}</span>
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
