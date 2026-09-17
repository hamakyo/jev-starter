import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { EntryType } from "@typesafe-ai/sdk";
import type { EvaluationCase } from "../core/types.js";

/** A parsed JSONL dataset with the hash of the exact source bytes. */
export interface LoadedDataset<TExpected = string> {
  readonly items: readonly EvaluationCase<TExpected>[];
  readonly sha256: string;
  readonly byteLength: number;
  /** Defaults to source bytes for JSONL; cascade subsets use selection ids. */
  readonly hashBasis?: "source-bytes" | "selection-ids";
  readonly parentHash?: string;
  readonly selectionIds?: readonly string[];
}

/** Load a UTF-8 JSONL string or byte sequence with line-aware validation. */
export function loadJsonl<TExpected = string>(
  input: string | Uint8Array,
): LoadedDataset<TExpected> {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  const text = new TextDecoder().decode(bytes);
  const items: EvaluationCase<TExpected>[] = [];
  const ids = new Set<string>();

  for (const [zeroBasedLine, rawLine] of text.split(/\r?\n/).entries()) {
    const lineNumber = zeroBasedLine + 1;
    const line = rawLine.trim();
    if (line.length === 0) {
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(line) as unknown;
    } catch (error) {
      throw new SyntaxError(`Invalid JSONL at line ${lineNumber}: ${errorMessage(error)}`);
    }

    const record = asRecord(parsed, lineNumber);
    const id = requiredString(record, "id", lineNumber);
    if (ids.has(id)) {
      throw new SyntaxError(`Duplicate evaluation id "${id}" at line ${lineNumber}`);
    }
    ids.add(id);

    if (!hasOwn(record, "state") || !isEntryType(record.state)) {
      throw new SyntaxError(`Invalid state at line ${lineNumber}: expected a JSON EntryType`);
    }
    if (!hasOwn(record, "expected")) {
      throw new SyntaxError(`Missing expected value at line ${lineNumber}`);
    }

    const tags = record.tags;
    if (
      tags !== undefined &&
      (!Array.isArray(tags) || tags.some((tag) => typeof tag !== "string"))
    ) {
      throw new SyntaxError(`Invalid tags at line ${lineNumber}: expected an array of strings`);
    }

    items.push({
      id,
      state: record.state,
      expected: record.expected as TExpected,
      ...(tags === undefined ? {} : { tags: tags as string[] }),
    });
  }

  return {
    items,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    byteLength: bytes.byteLength,
  };
}

/** Load a JSONL dataset from disk without changing the source bytes first. */
export function loadJsonlFile<TExpected = string>(path: string): LoadedDataset<TExpected> {
  return loadJsonl<TExpected>(readFileSync(path));
}

function requiredString(record: Record<string, unknown>, key: string, lineNumber: number): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new SyntaxError(`Invalid ${key} at line ${lineNumber}: expected a non-empty string`);
  }
  return value;
}

function isEntryType(value: unknown): value is EntryType {
  if (value === null || typeof value === "string") {
    return true;
  }
  return (Array.isArray(value) || isRecord(value)) && isJsonValue(value);
}

function isJsonValue(value: unknown): boolean {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return typeof value !== "number" || Number.isFinite(value);
  }
  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }
  if (isRecord(value)) {
    return Object.values(value).every(isJsonValue);
  }
  return false;
}

function asRecord(value: unknown, lineNumber: number): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new SyntaxError(`Invalid JSONL at line ${lineNumber}: expected an object`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
