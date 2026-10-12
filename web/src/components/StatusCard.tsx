import { IIC_NAMES, answerClass, classColor, type SeizureEvent, type Status } from "@/lib/status";

type Props = {
  status: Status; // the bed status, as on the light
  answer: number[]; // the latest model answer
  classes: string[];
  ongoing: SeizureEvent | undefined; // the seizure event going on, if any
  clock: (clipS: number) => string; // clip seconds -> axis time
};

const RED = "#e5484d";
const DARK = "#2b2827";

// The bed's status now, as one word on a card in the status color. A seizure event: a big red
// card that flashes, with the detection and onset times. Otherwise the latest answer: "Healthy"
// (green), its IIC pattern (in the pattern's color), or a single confident seizure call, which
// is not yet a seizure (yellow).
export function StatusCard({ status, answer, classes, ongoing, clock }: Props) {
  const cls = answerClass(answer, classes);
  let word: string, detail: string, color: string;
  if (status === "seizure" && ongoing) {
    [word, detail, color] = ["Seizure", `Detected ${clock(ongoing.detectS)} · onset ≈ ${clock(ongoing.onsetS)}`, RED];
  } else if (cls === "SZ") {
    [word, detail, color] = ["Possible seizure", "One confident seizure call. A seizure needs 2 in a row.", classColor("GRDA")];
  } else if (cls === "Other") {
    [word, detail, color] = ["Healthy", "No IIC pattern or seizure in the latest answer", classColor("Other")];
  } else {
    [word, detail, color] = [cls, IIC_NAMES[cls], classColor(cls)];
  }
  const yellow = color === classColor("GRDA"); // dark text on yellow; white on the other colors
  return (
    <section
      className={`card status-card${word === "Seizure" ? " seizure" : ""}`}
      style={{ background: color, color: yellow ? DARK : "#fff" }}
      role="status"
      aria-live="polite"
    >
      <b>{word}</b>
      <span>{detail}</span>
    </section>
  );
}
