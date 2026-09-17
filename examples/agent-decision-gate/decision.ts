import { choice } from "@typesafe-ai/sdk";
import { defineDecision } from "../../src/index.js";

export const agentQuestions = {
  nextAction: choice("What should the host application do next?", {
    continue: null,
    tool: null,
    fallback: null,
    review: null,
    stop: null,
  }),
} as const;

export const agentDecisionGate = defineDecision({
  id: "example.agent-decision-gate",
  version: "1",
  questions: agentQuestions,
  policy: {
    kind: "confidence",
    question: "nextAction",
    autoThreshold: 0.9,
    fallbackThreshold: 0.6,
  },
});

export type AgentAction = keyof typeof agentQuestions.nextAction.criteria & string;

/** A recommendation only; the switch deliberately does not execute a tool. */
export function hostOperationFor(
  action: AgentAction,
):
  | { readonly kind: "continue" }
  | { readonly kind: "tool-recommendation" }
  | { readonly kind: "fallback" }
  | { readonly kind: "review" }
  | { readonly kind: "stop" } {
  switch (action) {
    case "continue":
      return { kind: "continue" };
    case "tool":
      return { kind: "tool-recommendation" };
    case "fallback":
      return { kind: "fallback" };
    case "review":
      return { kind: "review" };
    case "stop":
      return { kind: "stop" };
  }
}
