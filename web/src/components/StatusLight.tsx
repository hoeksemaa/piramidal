import { answerLabel, status } from "@/lib/status";

type Props = { probs: number[][]; k: number; classes: string[] };

// Green / yellow / red model status for one bed at model answer k. Hover shows the answer.
export function StatusLight({ probs, k, classes }: Props) {
  const label = answerLabel(probs[k], classes);
  return <span className={`light ${status(probs, k, classes)}`} title={label} role="img" aria-label={label} />;
}
