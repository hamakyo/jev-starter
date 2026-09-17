import { choice, noul, score } from "@typesafe-ai/sdk";
import {
  createChoiceAnswer,
  createNoulAnswer,
  createProviderResult,
  createScoreAnswer,
} from "../../src/index.js";
import type { AnswersFor } from "../../src/providers/types.js";

export const fixtureQuestions = {
  category: choice("Category?", { billing: null, technical: null }),
  quality: score("Quality?", ["low", "high"] as const),
  grounded: noul("Grounded?"),
} as const;

export const fixtureAnswers: AnswersFor<typeof fixtureQuestions> = {
  category: createChoiceAnswer<typeof fixtureQuestions.category.criteria>({
    choice: "billing",
    confidence: 0.95,
    probabilities: { billing: 0.95, technical: 0.05 },
  }),
  quality: createScoreAnswer<typeof fixtureQuestions.quality.criteria>({
    score: 0.8,
    confidence: 0.9,
    legend: { 0: "low", 1: "high" },
    probabilities: { 0: 0.8, 1: 0.2 },
  }),
  grounded: createNoulAnswer(0.9),
};

export const fixtureProviderResult = createProviderResult<typeof fixtureQuestions>(fixtureAnswers, {
  model: "mock-fixture",
  latencyMs: 1,
  usage: { inputTokens: 3, outputTokens: 2 },
});
