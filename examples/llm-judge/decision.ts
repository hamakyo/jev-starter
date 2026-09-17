import { noul } from "@typesafe-ai/sdk";
import { defineDecision } from "../../src/index.js";

export const judgeQuestions = {
  grounded: noul("Is the generated answer fully supported by the supplied evidence?"),
} as const;

export const llmJudge = defineDecision({
  id: "example.llm-judge",
  version: "1",
  questions: judgeQuestions,
  policy: {
    kind: "binary-band",
    question: "grounded",
    negativeThreshold: 0.1,
    positiveThreshold: 0.9,
    uncertainRoute: "fallback",
  },
});
