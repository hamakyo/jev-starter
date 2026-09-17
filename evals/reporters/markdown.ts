import type {
  CascadeReport,
  ComparisonReport,
  EvaluationComponentMetric,
  EvaluationComponentMetrics,
  EvaluationReport,
} from "../core/types.js";
import type { EvaluationAnyReport } from "./json.js";

/** Render a compact human-readable summary without hiding the machine report. */
export function toMarkdownReport(report: EvaluationAnyReport): string {
  switch (report.kind) {
    case "evaluation-report":
      return evaluationMarkdown(report);
    case "comparison-report":
      return comparisonMarkdown(report);
    case "cascade-report":
      return cascadeMarkdown(report);
  }
}

function evaluationMarkdown(report: EvaluationReport): string {
  const metrics = report.metrics;
  return [
    "# Evaluation report",
    "",
    `- Dataset rows: ${report.dataset.count}`,
    `- Dataset SHA-256: \`${report.dataset.hash}\``,
    `- Overall accuracy (all rows): ${format(metrics.classification.overallAccuracy)}`,
    `- Successful accuracy: ${format(metrics.classification.successfulAccuracy)}`,
    `- Success rate: ${format(metrics.classification.successRate)}`,
    `- Failures: ${metrics.failures}`,
    `- Latency p50 / p95: ${formatNullable(metrics.latency.p50Ms)}ms / ${formatNullable(metrics.latency.p95Ms)}ms`,
    `- Usage: ${metrics.usage.inputTokens} input / ${metrics.usage.outputTokens} output tokens`,
    `- Cost: ${costText(metrics.cost)}`,
    "",
    "| Label | Support | Precision | Recall | F1 |",
    "| --- | ---: | ---: | ---: | ---: |",
    ...Object.entries(metrics.classification.perLabel).map(
      ([label, value]) =>
        `| ${label} | ${value.support} | ${format(value.precision)} | ${format(value.recall)} | ${format(value.f1)} |`,
    ),
    ...componentMarkdown(report.componentMetrics),
    "",
  ].join("\n");
}

function comparisonMarkdown(report: ComparisonReport): string {
  return [
    "# Evaluation comparison",
    "",
    `- Dataset SHA-256: \`${report.dataset.hash}\``,
    "",
    "| Run | Overall accuracy | Successful accuracy | Failures | p50 (ms) | p95 (ms) |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
    comparisonRow("Primary", report.primary),
    comparisonRow("Baseline", report.baseline),
    "",
    `Primary minus baseline overall accuracy: ${format(report.deltas.accuracy)}`,
    "",
  ].join("\n");
}

function cascadeMarkdown(report: CascadeReport): string {
  return [
    "# Cascade evaluation",
    "",
    `- Dataset SHA-256: \`${report.dataset.hash}\``,
    `- Primary resolved rate: ${format(report.primaryResolvedRate)}`,
    `- Primary failure rate: ${format(report.primaryFailureRate)}`,
    `- Fallback rate: ${format(report.fallbackRate)}`,
    `- End-to-end overall accuracy: ${format(report.endToEnd.metrics.classification.overallAccuracy)}`,
    `- End-to-end successful accuracy: ${format(report.endToEnd.metrics.classification.successfulAccuracy)}`,
    `- End-to-end failures: ${report.endToEnd.metrics.failures}`,
    `- End-to-end latency p50 / p95: ${formatNullable(report.endToEnd.metrics.latency.p50Ms)}ms / ${formatNullable(report.endToEnd.metrics.latency.p95Ms)}ms`,
    `- End-to-end usage: ${report.endToEnd.metrics.usage.inputTokens} input / ${report.endToEnd.metrics.usage.outputTokens} output tokens across ${report.endToEnd.metrics.usage.requests} legs`,
    `- End-to-end cost: ${costText(report.endToEnd.metrics.cost)}`,
    `- Fallback subset SHA-256: \`${report.fallbackSelection.subsetHash}\` (${report.fallbackSelection.ids.length} rows)`,
    "",
  ].join("\n");
}

function comparisonRow(label: string, report: EvaluationReport): string {
  return `| ${label} | ${format(report.metrics.classification.overallAccuracy)} | ${format(report.metrics.classification.successfulAccuracy)} | ${report.metrics.failures} | ${formatNullable(report.metrics.latency.p50Ms)} | ${formatNullable(report.metrics.latency.p95Ms)} |`;
}

function componentMarkdown(components: EvaluationComponentMetrics | undefined): string[] {
  if (components === undefined) {
    return [];
  }
  const rows = [
    "",
    "## Component metrics",
    "",
    "| Group | Judgment | Count | Accuracy | Brier | ECE |",
    "| --- | --- | ---: | ---: | ---: | ---: |",
  ];
  for (const [group, values] of [
    ["retrieval", components.retrieval],
    ["generation", components.generation],
  ] as const) {
    if (values === undefined) {
      continue;
    }
    for (const [name, metric] of Object.entries(values) as [string, EvaluationComponentMetric][]) {
      rows.push(
        `| ${group} | ${name} | ${metric.count} | ${format(metric.accuracy)} | ${format(metric.brier.score)} | ${format(metric.calibration.ece)} |`,
      );
    }
  }
  return rows;
}

function costText(cost: EvaluationReport["metrics"]["cost"]): string {
  return cost.status === "available"
    ? `$${cost.totalUsd.toFixed(6)} (${cost.snapshotVersion})`
    : `unavailable (${cost.reason})`;
}

function format(value: number): string {
  return value.toFixed(4);
}

function formatNullable(value: number | null): string {
  return value === null ? "n/a" : value.toFixed(2);
}
