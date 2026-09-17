/** Operational categories emitted for provider failures. */
export type DecisionErrorCategory =
  | "abort"
  | "timeout"
  | "authentication"
  | "permission"
  | "rate-limit"
  | "malformed-response"
  | "provider-outage"
  | "unknown";

/** Classify errors without depending on a particular SDK error class instance. */
export function classifyDecisionError(error: unknown): DecisionErrorCategory {
  const name = errorName(error).toLowerCase();
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  const status = isRecord(error) && typeof error.status === "number" ? error.status : undefined;

  if (name.includes("abort") || message.includes("aborted") || message.includes("cancelled")) {
    return "abort";
  }
  if (name.includes("timeout") || message.includes("timed out") || message.includes("timeout")) {
    return "timeout";
  }
  if (name.includes("authentication") || status === 401 || message.includes("api key")) {
    return "authentication";
  }
  if (name.includes("permission") || status === 403) {
    return "permission";
  }
  if (name.includes("ratelimit") || name.includes("rate_limit") || status === 429) {
    return "rate-limit";
  }
  if (
    name.includes("malformed") ||
    message.includes("malformed provider") ||
    message.includes("malformed typesafe")
  ) {
    return "malformed-response";
  }
  if (
    name.includes("connection") ||
    name.includes("internalserver") ||
    name.includes("provideroutage") ||
    (status !== undefined && status >= 500)
  ) {
    return "provider-outage";
  }
  return "unknown";
}

/** Return a stable, non-message error name for telemetry. */
export function errorName(error: unknown): string {
  if (error instanceof Error) {
    return error.name === "Error" ? error.constructor.name : error.name;
  }
  if (isRecord(error) && typeof error.name === "string") {
    return error.name;
  }
  return typeof error;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
