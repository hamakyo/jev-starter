import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runSupportRoutingLive } from "../../examples/support-routing/run-live.js";

/** Live evals are opt-in and fail before constructing a client when no key is present. */
export async function requireLiveApiKey(): Promise<string> {
  const apiKey = process.env.TYPESAFE_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("TYPESAFE_API_KEY is required for eval:live; no external request was made");
  }
  return apiKey;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await requireLiveApiKey();
  await runSupportRoutingLive();
}
