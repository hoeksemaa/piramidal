// Red needs a confident, sustained seizure call. On our 23 clips, a plain top-class SZ call
// is red for 67% of non-seizure answers; this rule is red for 6% and still catches 21 of 23.
const RED_P = 0.9;
const RED_RUN = 3; // answers in a row (6 s)

export type Status = "ok" | "pattern" | "seizure";

const argmax = (p: number[]) => p.indexOf(Math.max(...p));

// Red: P(SZ) >= RED_P in the last RED_RUN answers.
// Yellow: the top class is one of the 4 IIC patterns, or P(SZ) >= RED_P but not yet for RED_RUN answers.
// Green: anything else, including weak seizure calls (60% of non-seizure answers on our clips).
export function status(probs: number[][], k: number, classes: string[]): Status {
  const sz = classes.indexOf("SZ");
  const recent = probs.slice(Math.max(k - RED_RUN + 1, 0), k + 1);
  if (recent.length === RED_RUN && recent.every((p) => p[sz] >= RED_P)) return "seizure";
  const top = classes[argmax(probs[k])];
  return probs[k][sz] >= RED_P || (top !== "Other" && top !== "SZ") ? "pattern" : "ok";
}

/** e.g. "LPD 0.62 · SZ 0.31": the top class of one answer, and its P(SZ) if SZ is not the top. */
export function answerLabel(p: number[], classes: string[]) {
  const top = argmax(p);
  const sz = classes.indexOf("SZ");
  const head = `${classes[top]} ${p[top].toFixed(2)}`;
  return top === sz ? head : `${head} · SZ ${p[sz].toFixed(2)}`;
}
