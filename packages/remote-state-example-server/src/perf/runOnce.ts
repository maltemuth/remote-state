/**
 * One performance run: plays the games at once against a server, started for the
 * run unless a URL is given, and reports what was measured.
 */

import type { DiffName, Format } from "@malte.muth/remote-state";
import { ACTIONS_PER_GAME, playGame, type Samples } from "./battleshipGame.js";
import { type Parser } from "./player.js";
import { startServer } from "./startServer.js";
import { formatSummary, summarize, type Summary } from "./stats.js";

export interface RunOptions {
  games: number;
  pause: number;
  format: Format;
  /** How the started server computes patches */
  diff: DiffName;
  /** Whether it sends checksums, which the players check */
  checksums: boolean;
  /** Socket.IO's parser, on both ends */
  parser: Parser;
  /** Compress messages of at least this many bytes; null for none */
  deflate: number | null;
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
  /** Bytes the players' sockets received, per action */
  bytesPerAction: number;
  /** CPU milliseconds per action of the started server (null with `--url`), and of the load test */
  serverCpuPerAction: number | null;
  clientCpuPerAction: number;
  http: Summary;
  endToEnd: Summary;
}

export const runOnce = async (options: RunOptions): Promise<RunResult> => {
  const server = options.url
    ? null
    : await startServer(
        options.port,
        {
          DIFF: options.diff,
          CHECKSUMS: options.checksums ? "1" : "0",
          PARSER: options.parser,
          DEFLATE: options.deflate === null ? "" : String(options.deflate),
        },
        options.profileDirectory,
      );
  const base = options.url ?? server!.url;
  const { games, format, pause, parser } = options;

  const samples: Samples = { http: [], endToEnd: [], errors: 0, bytes: 0 };
  const started = performance.now();
  const clientCpu = process.cpuUsage();
  let serverCpu: number | null = null;
  try {
    await Promise.all(
      Array.from({ length: games }, () =>
        playGame({ base, format, parser, pause }, samples),
      ),
    );
  } finally {
    if (server) serverCpu = await server.stop();
  }
  const { user, system } = process.cpuUsage(clientCpu);
  const actions = samples.http.length;
  return {
    actions,
    seconds: (performance.now() - started) / 1000,
    errors: samples.errors,
    bytesPerAction: samples.bytes / actions,
    serverCpuPerAction: serverCpu === null ? null : serverCpu / actions,
    clientCpuPerAction: (user + system) / 1000 / actions,
    http: summarize(samples.http),
    endToEnd: summarize(samples.endToEnd),
  };
};

export const describeRun = ({
  games,
  pause,
  format,
  diff,
  checksums,
  parser,
  deflate,
}: RunOptions) =>
  `${games} battleship games at once, ${ACTIONS_PER_GAME} actions each, pause ${pause} ms, format ${format}, diff ${diff}, ` +
  `checksums ${checksums ? "on" : "off"}, parser ${parser}, deflate ${deflate === null ? "off" : `from ${deflate} bytes`}`;

export const formatResult = (result: RunResult) =>
  [
    `  ${result.actions} actions in ${result.seconds.toFixed(1)} s = ${(result.actions / result.seconds).toFixed(0)} actions/s, ${result.errors} errors`,
    `  received:       ${result.bytesPerAction.toFixed(0)} bytes per action, by both players`,
    `  CPU per action: ${result.serverCpuPerAction === null ? "?" : result.serverCpuPerAction.toFixed(2)} ms server, ${result.clientCpuPerAction.toFixed(2)} ms load test`,
    `  HTTP response:  ${formatSummary(result.http)}`,
    `  end to end:     ${formatSummary(result.endToEnd)}`,
  ].join("\n");
