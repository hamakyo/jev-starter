import type { Questions } from "@typesafe-ai/sdk";
import { validateAnswers } from "./validate-answers.js";

/** Validate the runtime shape returned by TypeSafe before it reaches policy code. */
export function validateSystemOneResult<Q extends Questions>(questions: Q, result: unknown): void {
  const response = asRecord(result, "response");
  validateModel(response, "response");
  validateAnswers(questions, requiredField(response, "answers", "response"), "response.answers");
  validateSdkUsage(requiredField(response, "usage", "response"));
}

/** Validate the normalized provider result before it reaches policy code. */
export function validateProviderResult<Q extends Questions>(questions: Q, result: unknown): void {
  const providerResult = asRecord(result, "providerResult");
  validateModel(providerResult, "providerResult");
  validateAnswers(
    questions,
    requiredField(providerResult, "answers", "providerResult"),
    "providerResult.answers",
  );

  const latencyMs = requiredField(providerResult, "latencyMs", "providerResult");
  if (typeof latencyMs !== "number" || !Number.isFinite(latencyMs) || latencyMs < 0) {
    malformed("providerResult.latencyMs", "must be a finite non-negative number");
  }

  if (hasOwn(providerResult, "usage") && providerResult.usage !== undefined) {
    validateProviderUsage(providerResult.usage);
  }
}

function validateModel(record: Record<string, unknown>, path: string): void {
  const model = requiredField(record, "model", path);
  if (typeof model !== "string" || model.trim().length === 0) {
    malformed(`${path}.model`, "must be a non-empty string");
  }
}

function validateSdkUsage(value: unknown): void {
  const usage = asRecord(value, "response.usage");
  assertNonNegativeInteger(
    requiredField(usage, "input_tokens", "response.usage"),
    "response.usage.input_tokens",
  );
  assertNonNegativeInteger(
    requiredField(usage, "output_tokens", "response.usage"),
    "response.usage.output_tokens",
  );
}

function validateProviderUsage(value: unknown): void {
  const usage = asRecord(value, "providerResult.usage");
  assertNonNegativeInteger(
    requiredField(usage, "inputTokens", "providerResult.usage"),
    "providerResult.usage.inputTokens",
  );
  assertNonNegativeInteger(
    requiredField(usage, "outputTokens", "providerResult.usage"),
    "providerResult.usage.outputTokens",
  );
}

function assertNonNegativeInteger(value: unknown, path: string): asserts value is number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    malformed(path, "must be a non-negative integer");
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
  throw new TypeError(`Malformed provider response at ${path}: ${reason}`);
}
