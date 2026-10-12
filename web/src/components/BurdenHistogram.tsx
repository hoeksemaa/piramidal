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

/** Seconds -> "m:ss". */
const mss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

// Pattern burden: the share of recent time in each class, from no seizure (left) to seizure (right).
// Each answer is labeled with the light's per-answer rule (answerClass) and counts for its 2 s step,
// so the bars are % of time. The span is the last 3 min, all the EEG a bed has; until the clip
// has played once, it is the time since the clip's start.
export function BurdenHistogram({ probs, classes, k, looped, stepS, clipS }: Props) {
  const answers = looped ? Math.min(probs.length, Math.round(clipS / stepS)) : k + 1;
  const pct = useMemo(() => {
    const counts = Object.fromEntries(SEVERITY_ORDER.map((c) => [c, 0]));
    for (const p of probs.slice(0, answers)) counts[answerClass(p, classes)]++;
    return SEVERITY_ORDER.map((c) => (100 * counts[c]) / answers);
  }, [probs, classes, answers]);

  return (
    <figure className="burden">
      <figcaption>
        <b>Pattern burden</b>
        <span>% of the last {mss(answers * stepS)}</span>
      </figcaption>
      <div className="burden-bars">
        {SEVERITY_ORDER.map((c, i) => (
          <div key={c} className="burden-col">
            <div className="burden-bar" style={{ height: `${pct[i]}%`, background: SEVERITY_COLORS[i] }} />
            <span className="burden-pct" style={{ bottom: `${pct[i]}%` }}>
              {pct[i] > 0 && pct[i] < 0.5 ? "<1" : Math.round(pct[i])}
            </span>
          </div>
        ))}
      </div>
      <div className="burden-labels">
        {SEVERITY_ORDER.map((c) => (
          <span key={c}>{c}</span>
        ))}
      </div>
      <div className="burden-axis">
        <span>no seizure</span>
        <span className="burden-arrow" />
        <span>seizure</span>
      </div>
      <p className="burden-note">
        One model answer every 2 s, each reading 10 s. SZ counts at P(SZ) ≥ 0.9.
      </p>
    </figure>
  );
}
