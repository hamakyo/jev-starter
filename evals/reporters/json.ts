import { writeFileSync } from "node:fs";
import type { CascadeReport, ComparisonReport, EvaluationReport } from "../core/types.js";

export type EvaluationAnyReport = EvaluationReport | ComparisonReport | CascadeReport;

/** Serialize an evaluation report in a stable, human-readable JSON shape. */
export function toJsonReport(report: EvaluationAnyReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

/** Persist a report when a CLI or release artifact explicitly requests a file. */
export function writeJsonReport(path: string, report: EvaluationAnyReport): void {
  writeFileSync(path, toJsonReport(report), "utf8");
}
