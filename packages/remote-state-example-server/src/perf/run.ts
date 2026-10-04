/**
 * Performance run: plays many battleship games at once against the example server
 * in its own process, and reports throughput and latency, up to the moment the
 * other player receives each update.
 *
 *   npm run perf -- --games 100 --pause 0 --format state [--url http://…] [--max-p95 50]
 *
 * Without `--url`, it starts the example server on a free port with databases in a
 * temporary directory. With `--max-p95`, it fails when the end-to-end p95 exceeds it.
 */

import { parseArgs } from "util";
import type { Format } from "@malte.muth/remote-state";
import { ACTIONS_PER_GAME, playGame, type Samples } from "./battleshipGame.js";
import { startServer } from "./startServer.js";
import { formatSummary, summarize } from "./stats.js";

const { values } = parseArgs({
  options: {
    games: { type: "string", default: "100" },
    pause: { type: "string", default: "0" },
    format: { type: "string", default: "state" },
    url: { type: "string" },
    port: { type: "string", default: "3999" },
    "max-p95": { type: "string" },
  },
});
const games = Number(values.games);
const pause = Number(values.pause);
const format = values.format as Format;

const server = values.url ? null : await startServer(Number(values.port));
const base = values.url ?? server!.url;

const samples: Samples = { http: [], endToEnd: [], errors: 0 };
const started = performance.now();
try {
  await Promise.all(
    Array.from({ length: games }, () =>
      playGame({ base, format, pause }, samples),
    ),
  );
} finally {
  await server?.stop();
}
const seconds = (performance.now() - started) / 1000;
const endToEnd = summarize(samples.endToEnd);

const report = [
  `${games} battleship games at once, ${ACTIONS_PER_GAME} actions each, pause ${pause} ms, format ${format}`,
  `  ${samples.http.length} actions in ${seconds.toFixed(1)} s = ${(samples.http.length / seconds).toFixed(0)} actions/s, ${samples.errors} errors`,
  `  HTTP response:  ${formatSummary(summarize(samples.http))}`,
  `  end to end:     ${formatSummary(endToEnd)}`,
];
process.stdout.write(`${report.join("\n")}\n`);

const budget = values["max-p95"] ? Number(values["max-p95"]) : null;
if (samples.errors > 0 || (budget !== null && endToEnd.p95 > budget)) {
  process.stdout.write(
    budget !== null && endToEnd.p95 > budget
      ? `End-to-end p95 of ${endToEnd.p95.toFixed(1)} ms exceeds the budget of ${budget} ms\n`
      : "Some actions failed\n",
  );
  process.exit(1);
}
process.exit(0);
