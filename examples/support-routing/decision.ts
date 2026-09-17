import { choice } from "@typesafe-ai/sdk";
import { defineDecision } from "../../src/index.js";

export const supportQuestions = {
  category: choice("What is this support ticket about?", {
    billing: null,
    technical: null,
    other: null,
  }),
} as const;

export const supportRouting = defineDecision({
  id: "example.support-routing",
  version: "1",
  questions: supportQuestions,
  policy: {
    kind: "confidence",
    question: "category",
    autoThreshold: 0.9,
    fallbackThreshold: 0.65,
  },
});

export type SupportCategory = keyof typeof supportQuestions.category.criteria & string;
