/**
 * Summarizes latency samples as percentiles.
 */

export interface Summary {
  p50: number;
  p95: number;
  p99: number;
  max: number;
}

const percentile = (sorted: number[], p: number) =>
  sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];

export const summarize = (samples: number[]): Summary => {
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    max: sorted[sorted.length - 1],
  };
};

export const formatSummary = ({ p50, p95, p99, max }: Summary) =>
  [
    `p50 ${p50.toFixed(1)}`,
    `p95 ${p95.toFixed(1)}`,
    `p99 ${p99.toFixed(1)}`,
    `max ${max.toFixed(1)} ms`,
  ].join("  ");
