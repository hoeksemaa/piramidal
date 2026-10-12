import { answerLabel, status } from "@/lib/status";

type Props = { answer: number[]; classes: string[] };

// Green / yellow / red for one model answer, 1:1. Hover shows the answer.
export function StatusLight({ answer, classes }: Props) {
  const label = answerLabel(answer, classes);
  return <span className={`light ${status(answer, classes)}`} title={label} role="img" aria-label={label} />;
}
