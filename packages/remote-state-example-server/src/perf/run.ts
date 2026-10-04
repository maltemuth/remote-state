/**
 * Performance run: plays many battleship games at once against the example server
 * in its own process, and reports throughput and latency, up to the moment the
 * other player receives each update.
 *
 *   npm run perf -- --games 100 --pause 0 --format state [--runs 3]
 *                   [--profile dir] [--url http://…] [--max-p95 50]
 *
 * Without `--url`, each run starts the example server on a free port with databases
 * in a temporary directory. With `--profile`, that server writes a CPU profile per
 * run into the directory. With `--max-p95`, it fails when any run's end-to-end p95
 * exceeds it.
 */

import { parseArgs } from "util";
import type { Format } from "@malte.muth/remote-state";
import {
  describeRun,
  formatResult,
  runOnce,
  type RunOptions,
} from "./runOnce.js";

const { values } = parseArgs({
  options: {
    games: { type: "string", default: "100" },
    pause: { type: "string", default: "0" },
    format: { type: "string", default: "state" },
    runs: { type: "string", default: "1" },
    profile: { type: "string" },
    url: { type: "string" },
    port: { type: "string", default: "3999" },
    "max-p95": { type: "string" },
  },
});
if (values.url && values.profile) {
  throw new Error("--profile needs a server started by the run, not --url");
}

const options: RunOptions = {
  games: Number(values.games),
  pause: Number(values.pause),
  format: values.format as Format,
  url: values.url,
  port: Number(values.port),
  profileDirectory: values.profile,
};
const runs = Number(values.runs);
const budget = values["max-p95"] ? Number(values["max-p95"]) : null;

process.stdout.write(`${describeRun(options)}\n`);
let failed = false;
for (let run = 1; run <= runs; run++) {
  const result = await runOnce(options);
  if (runs > 1) process.stdout.write(`run ${run} of ${runs}\n`);
  process.stdout.write(`${formatResult(result)}\n`);

  if (result.errors > 0) {
    process.stdout.write("Some actions failed\n");
    failed = true;
  } else if (budget !== null && result.endToEnd.p95 > budget) {
    process.stdout.write(
      `End-to-end p95 of ${result.endToEnd.p95.toFixed(1)} ms exceeds the budget of ${budget} ms\n`,
    );
    failed = true;
  }
}
process.exit(failed ? 1 : 0);
