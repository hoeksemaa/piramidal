import { answerLabel, type Status } from "@/lib/status";

type Props = { status: Status; answer: number[]; classes: string[] };

// Green / yellow / red status for one bed (see bedStatus). Hover shows the latest answer.
export function StatusLight({ status, answer, classes }: Props) {
  const label = (status === "seizure" ? "Seizure going on · " : "") + answerLabel(answer, classes);
  return <span className={`light ${status}`} title={label} role="img" aria-label={label} />;
}
