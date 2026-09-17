import { noul } from "@typesafe-ai/sdk";

/** Retrieval judgments keep chunk-level and context-set-level signals separate. */
export const retrievalQuestions = {
  chunkRelevanceC1: noul("Does retrieved chunk c1 contain information relevant to the question?"),
  chunkRelevanceC2: noul("Does retrieved chunk c2 contain information relevant to the question?"),
  contextSufficiency: noul("Is the retrieved context set sufficient to answer the question?"),
  contextConflict: noul("Does the retrieved context set contain materially conflicting evidence?"),
} as const;
