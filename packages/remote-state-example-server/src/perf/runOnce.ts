/**
 * One performance run: plays the games at once against a server, started for the
 * run unless a URL is given, and reports what was measured.
 */

import type { Format } from "@malte.muth/remote-state";
import { ACTIONS_PER_GAME, playGame, type Samples } from "./battleshipGame.js";
import { startServer } from "./startServer.js";
import { formatSummary, summarize, type Summary } from "./stats.js";

export interface RunOptions {
  games: number;
  pause: number;
  format: Format;
  /** A running server to test; without it, one is started for the run */
  url?: string;
  port: number;
  /** Write a CPU profile of the started server into this directory */
  profileDirectory?: string;
}

export interface RunResult {
  actions: number;
  seconds: number;
  errors: number;
  http: Summary;
  endToEnd: Summary;
}

export const runOnce = async (options: RunOptions): Promise<RunResult> => {
  const server = options.url
    ? null
    : await startServer(options.port, options.profileDirectory);
  const base = options.url ?? server!.url;
  const { games, format, pause } = options;

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
  return {
    actions: samples.http.length,
    seconds: (performance.now() - started) / 1000,
    errors: samples.errors,
    http: summarize(samples.http),
    endToEnd: summarize(samples.endToEnd),
  };
};

export const describeRun = ({ games, pause, format }: RunOptions) =>
  `${games} battleship games at once, ${ACTIONS_PER_GAME} actions each, pause ${pause} ms, format ${format}`;

export const formatResult = (result: RunResult) =>
  [
    `  ${result.actions} actions in ${result.seconds.toFixed(1)} s = ${(result.actions / result.seconds).toFixed(0)} actions/s, ${result.errors} errors`,
    `  HTTP response:  ${formatSummary(result.http)}`,
    `  end to end:     ${formatSummary(result.endToEnd)}`,
  ].join("\n");
