import { IIC_NAMES, answerClass, statusWord, type SeizureEvent, type Status } from "@/lib/status";

type Props = {
  status: Status; // the bed status, as on the light
  answer: number[]; // the latest model answer
  classes: string[];
  ongoing: SeizureEvent | undefined; // the seizure event going on, if any
  clock: (clipS: number) => string; // clip seconds -> axis time
};

// The bed's status now, as one word on a card in the status color. A seizure event: a big red
// card that flashes, with the detection and onset times. Otherwise the latest answer: "Healthy"
// (green), its IIC pattern (in the pattern's color), or a single confident seizure call, which
// is not yet a seizure (yellow).
export function StatusCard({ status, answer, classes, ongoing, clock }: Props) {
  const { word, color, dark } = statusWord(status, answer, classes);
  const cls = answerClass(answer, classes);
  const detail =
    status === "seizure" && ongoing
      ? `Detected ${clock(ongoing.detectS)} · onset ≈ ${clock(ongoing.onsetS)}`
      : cls === "SZ"
        ? "One confident seizure call. A seizure needs 2 in a row."
        : cls === "Other"
          ? "No IIC pattern or seizure in the latest answer"
          : IIC_NAMES[cls];
  return (
    <section
      className={`card status-card${status === "seizure" ? " seizure" : ""}`}
      style={{ background: color, color: dark ? "#2b2827" : "#fff" }}
      role="status"
      aria-live="polite"
    >
      <b>{word}</b>
      <span>{detail}</span>
    </section>
  );
}
