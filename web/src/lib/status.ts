// Red needs a confident, sustained seizure call. On our 23 clips, a plain top-class SZ call
// is red for 67% of non-seizure answers; this rule is red for 6% and still catches 21 of 23.
const RED_P = 0.9;
const RED_RUN = 3; // answers in a row (6 s)

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

// Red: severity 6 in the last RED_RUN answers. Yellow: severity 2-6 now. Green: severity 1.
export function status(probs: number[][], k: number, classes: string[]): Status {
  const recent = probs.slice(Math.max(k - RED_RUN + 1, 0), k + 1);
  if (recent.length === RED_RUN && recent.every((p) => severity(p, classes) === MAX_SEVERITY)) return "seizure";
  return severity(probs[k], classes) > 1 ? "pattern" : "ok";
}

/** e.g. "LPD 0.62 · SZ 0.31": the top class of one answer, and its P(SZ) if SZ is not the top. */
export function answerLabel(p: number[], classes: string[]) {
  const top = argmax(p);
  const sz = classes.indexOf("SZ");
  const head = `${classes[top]} ${p[top].toFixed(2)}`;
  return top === sz ? head : `${head} · SZ ${p[sz].toFixed(2)}`;
}
