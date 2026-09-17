import type { Questions } from "@typesafe-ai/sdk";

/** Validate an answer map against the question definitions that produced it. */
export function validateAnswers<Q extends Questions>(
  questions: Q,
  value: unknown,
  answersPath = "answers",
): void {
  const answers = asRecord(value, answersPath);
  const questionRecord = asRecord(questions, "request.questions");
  const questionNames = Object.keys(questionRecord);

  for (const name of questionNames) {
    if (!hasOwn(answers, name)) {
      malformed(`${answersPath}.${name}`, "is missing");
    }
    const question = asRecord(questionRecord[name], `request.questions.${name}`);
    validateQuestionDefinition(question, `request.questions.${name}`);
    validateAnswer(question, answers[name], `${answersPath}.${name}`);
  }

  for (const name of Object.keys(answers)) {
    if (!hasOwn(questionRecord, name)) {
      malformed(`${answersPath}.${name}`, "does not correspond to a requested question");
    }
  }
}

function validateQuestionDefinition(value: unknown, path: string): void {
  const question = asRecord(value, path);
  const type = requiredField(question, "type", path);
  if (typeof type !== "string") {
    malformed(`${path}.type`, "must be a string");
  }

  switch (type) {
    case "noul":
      return;
    case "choice": {
      const criteria = asRecord(requiredField(question, "criteria", path), `${path}.criteria`);
      if (Object.keys(criteria).length === 0) {
        malformed(`${path}.criteria`, "must contain at least one label");
      }
      return;
    }
    case "score": {
      const criteria = requiredField(question, "criteria", path);
      if (!Array.isArray(criteria) || criteria.length < 2) {
        malformed(`${path}.criteria`, "must contain at least two rubric entries");
      }
      return;
    }
    default:
      malformed(`${path}.type`, 'must be "noul", "choice", or "score"');
  }
}

function validateAnswer(question: Record<string, unknown>, value: unknown, path: string): void {
  const answer = asRecord(value, path);
  const type = requiredField(answer, "type", path);

  switch (question.type) {
    case "noul":
      if (type !== "noul") {
        malformed(`${path}.type`, 'must be "noul" for a noul question');
      }
      assertProbability(requiredField(answer, "noul", path), `${path}.noul`);
      return;
    case "choice":
      validateChoiceAnswer(question, answer, path, type);
      return;
    case "score":
      validateScoreAnswer(question, answer, path, type);
      return;
    default:
      malformed(`${path}.type`, "cannot be validated for an unknown question type");
  }
}

function validateChoiceAnswer(
  question: Record<string, unknown>,
  answer: Record<string, unknown>,
  path: string,
  type: unknown,
): void {
  if (type !== "choice") {
    malformed(`${path}.type`, 'must be "choice" for a choice question');
  }
  const criteria = asRecord(question.criteria, "question.criteria");
  const labels = Object.keys(criteria);
  const selected = requiredField(answer, "choice", path);
  if (typeof selected !== "string" || !hasOwn(criteria, selected)) {
    malformed(`${path}.choice`, "must be one of the labels in the question criteria");
  }
  assertProbability(requiredField(answer, "confidence", path), `${path}.confidence`);
  validateProbabilityMap(
    requiredField(answer, "probabilities", path),
    labels,
    `${path}.probabilities`,
  );
}

function validateScoreAnswer(
  question: Record<string, unknown>,
  answer: Record<string, unknown>,
  path: string,
  type: unknown,
): void {
  if (type !== "score") {
    malformed(`${path}.type`, 'must be "score" for a score question');
  }
  const criteria = question.criteria;
  if (!Array.isArray(criteria)) {
    malformed("question.criteria", "must be a rubric array");
  }
  const indexes = criteria.map((_, index) => String(index));
  assertFiniteNumber(requiredField(answer, "score", path), `${path}.score`);
  assertProbability(requiredField(answer, "confidence", path), `${path}.confidence`);
  validateScoreLegend(requiredField(answer, "legend", path), criteria, `${path}.legend`);
  validateProbabilityMap(
    requiredField(answer, "probabilities", path),
    indexes,
    `${path}.probabilities`,
  );
}

function validateScoreLegend(value: unknown, criteria: unknown[], path: string): void {
  const legend = asRecord(value, path);
  const indexes = criteria.map((_, index) => String(index));

  for (const [index, key] of indexes.entries()) {
    const actual = requiredField(legend, key, path);
    if (actual === undefined) {
      malformed(`${path}.${key}`, "must not be undefined");
    }

    const expected = criteria[index];
    if (expected === undefined) {
      malformed(`${path}.${key}`, "cannot match an undefined question criterion");
    }
    if (!deepEqualJson(actual, expected)) {
      malformed(`${path}.${key}`, "must match the corresponding question criterion");
    }
  }

  rejectUnexpectedKeys(legend, indexes, path);
}

function validateProbabilityMap(value: unknown, keys: string[], path: string): void {
  const probabilities = asRecord(value, path);
  for (const key of keys) {
    assertProbability(requiredField(probabilities, key, path), `${path}.${key}`);
  }
  rejectUnexpectedKeys(probabilities, keys, path);
}

function rejectUnexpectedKeys(
  record: Record<string, unknown>,
  expectedKeys: string[],
  path: string,
): void {
  const expected = new Set(expectedKeys);
  for (const key of Object.keys(record)) {
    if (!expected.has(key)) {
      malformed(`${path}.${key}`, "is not part of the requested question definition");
    }
  }
}

function deepEqualJson(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true;
  }

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
      return false;
    }
    return left.every((value, index) => deepEqualJson(value, right[index]));
  }

  if (isRecord(left) || isRecord(right)) {
    if (!isRecord(left) || !isRecord(right)) {
      return false;
    }
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    if (leftKeys.length !== rightKeys.length) {
      return false;
    }
    return leftKeys.every((key) => hasOwn(right, key) && deepEqualJson(left[key], right[key]));
  }

  return false;
}

function assertProbability(value: unknown, path: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    malformed(path, "must be a finite number between 0 and 1");
  }
}

function assertFiniteNumber(value: unknown, path: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    malformed(path, "must be a finite number");
  }
}

function asRecord(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value)) {
    malformed(path, "must be an object");
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredField(record: Record<string, unknown>, key: string, path: string): unknown {
  if (!hasOwn(record, key)) {
    malformed(`${path}.${key}`, "is required");
  }
  return record[key];
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function malformed(path: string, reason: string): never {
  throw new TypeError(`Malformed provider answer at ${path}: ${reason}`);
}
