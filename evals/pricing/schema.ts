import type { ProviderUsage } from "../../src/providers/types.js";

/** Explicit per-million-token prices captured for one evaluation snapshot. */
export interface ModelPricing {
  readonly inputUsdPerMillionTokens: number;
  readonly outputUsdPerMillionTokens: number;
}

export interface PricingSnapshot {
  readonly version: string;
  readonly currency: "USD";
  readonly models: Readonly<Record<string, ModelPricing>>;
}

export type CostReport =
  | {
      readonly status: "available";
      readonly currency: "USD";
      readonly totalUsd: number;
      readonly snapshotVersion: string;
    }
  | {
      readonly status: "unavailable";
      readonly currency: "USD";
      readonly totalUsd: null;
      readonly reason: string;
      readonly snapshotVersion?: string;
    };

/** Calculate one model's cost from a versioned, caller-supplied pricing snapshot. */
export function costForUsage(
  model: string | undefined,
  usage: ProviderUsage | undefined,
  snapshot: PricingSnapshot | undefined,
): number | null {
  if (model === undefined || usage === undefined || snapshot === undefined) {
    return null;
  }
  const pricing = snapshot.models[model];
  if (pricing === undefined) {
    return null;
  }
  assertPrice(pricing.inputUsdPerMillionTokens, "input price");
  assertPrice(pricing.outputUsdPerMillionTokens, "output price");
  assertUsage(usage);
  return (
    (usage.inputTokens * pricing.inputUsdPerMillionTokens +
      usage.outputTokens * pricing.outputUsdPerMillionTokens) /
    1_000_000
  );
}

/** Aggregate costs, returning unavailable instead of inventing a price. */
export function costReport(
  samples: readonly { readonly model?: string; readonly usage?: ProviderUsage }[],
  snapshot: PricingSnapshot | undefined,
): CostReport {
  if (snapshot === undefined) {
    return {
      status: "unavailable",
      currency: "USD",
      totalUsd: null,
      reason: "No pricing snapshot was supplied",
    };
  }
  if (typeof snapshot.version !== "string" || snapshot.version.trim().length === 0) {
    throw new TypeError("Pricing snapshot version must be a non-empty string");
  }

  let totalUsd = 0;
  for (const sample of samples) {
    const cost = costForUsage(sample.model, sample.usage, snapshot);
    if (cost === null) {
      return {
        status: "unavailable",
        currency: "USD",
        totalUsd: null,
        reason: "A model or usage record could not be priced by the supplied snapshot",
        snapshotVersion: snapshot.version,
      };
    }
    totalUsd += cost;
  }
  return {
    status: "available",
    currency: "USD",
    totalUsd,
    snapshotVersion: snapshot.version,
  };
}

function assertPrice(value: number, label: string): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a finite non-negative number`);
  }
}

function assertUsage(usage: ProviderUsage): void {
  if (
    !Number.isInteger(usage.inputTokens) ||
    usage.inputTokens < 0 ||
    !Number.isInteger(usage.outputTokens) ||
    usage.outputTokens < 0
  ) {
    throw new RangeError("Token usage must contain non-negative integer values");
  }
}
