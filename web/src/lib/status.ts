// The numbers below come from the 23 test clips, one seizure each (build_beds.py --seizure).
// A confident seizure call needs P(SZ) >= 0.9: on the test clips, a plain top-class SZ call is
// 67% of non-seizure answers; P >= 0.9 is 9.5% of them, and still shows in 22 of 23 seizures.
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
  // A seizure call below RED_P counts as Other: on the test clips, 60% of non-seizure answers are one.
  return top === "SZ" ? LEVEL.Other : LEVEL[top];
}

// One answer alone: "seizure" for a confident seizure call (severity 6), "pattern" for an IIC
// pattern (severity 2-5), else "ok". The seizure rule below groups these answers into events.
export function answerStatus(p: number[], classes: string[]): Status {
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

// A seizure is an event, not one answer. The rule follows the clinical reading of the EEG:
// - Start: START_RUN red answers in a row. A real seizure lasts at least 10 s (ACNS 2021), and
//   windows overlap by 8 s, so it shows in 2 windows in a row. A lone red answer is usually
//   flicker at the 0.9 cut: on the test clips, 6 of 7 lone reds fall outside the expert labels.
// - End: END_GAP answers in a row that are not red, about 10 s of non-seizure EEG. Shorter dips
//   are the same seizure. A lower "stay on" threshold instead made ends overrun by up to 2 min.
// On the 23 test clips: 22 seizures caught, detected a median 10 s after the expert onset; 11 false
// events in 49 min of EEG near the seizures; 2 seizures split in two. On the 23 random clips of
// the wall: all 3 labeled seizures caught; 13 false events in 60 min of seizure-free EEG.
const START_RUN = 2;
const END_GAP = 5;

/** One seizure event. Answer indices, and times in clip seconds. */
export type SeizureEvent = {
  detectK: number; // the answer that completes the start run
  endK: number; // the answer that completes the end gap: from here the event is over
  onsetS: number; // estimated onset: the start of the first red window
  detectS: number; // when the event was detected
  endS: number; // estimated end: the end of the last red window
  endedS: number; // when the end was known
};

// Answer k reads the EEG in [k * stepS - windowS, k * stepS) and arrives at k * stepS. A red answer
// says a seizure is somewhere in its window, so the onset estimate is the first window's start:
// the time a clinician dates the seizure from, not the time the model saw it.
export function seizureEvents(probs: number[][], classes: string[], stepS: number, windowS: number) {
  const red = probs.map((p) => answerStatus(p, classes) === "seizure");
  const events: SeizureEvent[] = [];
  for (let k = 0; k + START_RUN <= red.length; k++) {
    if (!red.slice(k, k + START_RUN).every(Boolean)) continue;
    let last = k + START_RUN - 1;
    for (let j = last + 1; j < red.length && j - last <= END_GAP; j++) if (red[j]) last = j;
    events.push({
      detectK: k + START_RUN - 1,
      endK: last + END_GAP,
      onsetS: k * stepS - windowS,
      detectS: (k + START_RUN - 1) * stepS,
      endS: last * stepS,
      endedS: (last + END_GAP) * stepS,
    });
    k = last + END_GAP;
  }
  return events;
}

/** The event that is going on at answer k, if any: detected, and its end not yet known. */
export const ongoingEvent = (events: SeizureEvent[], k: number) => events.find((e) => e.detectK <= k && k < e.endK);

// A bed's status light at answer k. Red if and only if a seizure event is going on, so the light
// always agrees with the SEIZURE tag and the band. Otherwise the light shows the latest answer:
// yellow for an IIC pattern or a single confident seizure call (not yet a seizure), else green.
// On the test clips, red is 14% of non-seizure answers (1:1 was 9.5%): red holds until the end is known.
export function bedStatus(events: SeizureEvent[], p: number[], k: number, classes: string[]): Status {
  if (ongoingEvent(events, k)) return "seizure";
  return answerStatus(p, classes) === "ok" ? "ok" : "pattern";
}
