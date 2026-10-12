// The light shows the latest model answer, 1:1. Red needs P(SZ) >= 0.9: on our 23 clips, a plain
// top-class SZ call is red for 67% of non-seizure answers; P >= 0.9 is red for 9.5% and catches 22 of 23.
const RED_P = 0.9;

// Severity of one model answer, 1 (lowest) to 6 (highest): Other; the 4 IIC patterns in rough
// order of published seizure risk (GRDA lowest, LPD highest); then a confident seizure call.
const LEVEL: Record<string, number> = { Other: 1, GRDA: 2, GPD: 3, LRDA: 4, LPD: 5, SZ: 6 };
export const MAX_SEVERITY = 6;
// Display color per severity 1-6: green, 2 yellow, 2 orange, red.
export const SEVERITY_COLORS = ["#3fa56b", "#e3c21a", "#e3c21a", "#ec7a2a", "#ec7a2a", "#e5484d"];

export type Status = "ok" | "pattern" | "seizure";

const argmax = (p: number[]) => p.indexOf(Math.max(...p));

export function severity(p: number[], classes: string[]) {
  if (p[classes.indexOf("SZ")] >= RED_P) return LEVEL.SZ;
  const top = classes[argmax(p)];
  // A seizure call below RED_P counts as Other: on our clips, 60% of non-seizure answers are one.
  return top === "SZ" ? LEVEL.Other : LEVEL[top];
}

// Red: severity 6. Yellow: severity 2-5. Green: severity 1.
export function status(p: number[], classes: string[]): Status {
  const s = severity(p, classes);
  return s === MAX_SEVERITY ? "seizure" : s > 1 ? "pattern" : "ok";
}

/** e.g. "LPD 0.62 · SZ 0.31": the top class of one answer, and its P(SZ) if SZ is not the top. */
export function answerLabel(p: number[], classes: string[]) {
  const top = argmax(p);
  const sz = classes.indexOf("SZ");
  const head = `${classes[top]} ${p[top].toFixed(2)}`;
  return top === sz ? head : `${head} · SZ ${p[sz].toFixed(2)}`;
}

/** One run of red answers, first..last. Times are in clip seconds. */
export type SeizureEvent = {
  first: number;
  last: number;
  detectS: number; // when the first red answer arrived: the end of the EEG it read
  onsetS: number; // estimated onset: the start of the first red answer's window
  endS: number; // the end of the last red answer's window
};

// Answer k reads the EEG in [k * stepS - windowS, k * stepS) and arrives at k * stepS. A red answer
// says a seizure is somewhere in its window, so the onset estimate is that window's start: the time
// a clinician dates the seizure from, not the time the model saw it.
export function seizureEvents(probs: number[][], classes: string[], stepS: number, windowS: number) {
  const events: SeizureEvent[] = [];
  probs.forEach((p, k) => {
    if (status(p, classes) !== "seizure") return;
    const prev = events.at(-1);
    if (prev && prev.last === k - 1) {
      prev.last = k;
      prev.endS = k * stepS;
    } else {
      events.push({ first: k, last: k, detectS: k * stepS, onsetS: k * stepS - windowS, endS: k * stepS });
    }
  });
  return events;
}
