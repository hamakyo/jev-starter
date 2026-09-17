import { noul } from "@typesafe-ai/sdk";

/** Generation judgments are independent atomic questions, not one aggregate score. */
export const generationQuestions = {
  answerRelevance: noul("Does the generated answer directly address the question?"),
  groundedness: noul("Is the generated answer supported by the retrieved context?"),
  contradiction: noul("Does the generated answer contradict the retrieved context?"),
} as const;

/** Reference-dependent question kept out of requests without a reference answer. */
export const correctnessQuestion = {
  correctness: noul("Is the generated answer consistent with the reference answer?"),
} as const;
