/**
 * Runs the example host: both games and the tic-tac-toe browser client from
 * ../public, with games kept in the working directory. The host, not the library,
 * decides when the process exits.
 */

import { consoleLogger, type DiffName } from "@malte.muth/remote-state";
import msgpackParser from "socket.io-msgpack-parser";
import path from "path";
import process from "process";
import { fileURLToPath } from "url";
import { createExampleServer } from "./host/servers.js";

const publicDirectory = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../public",
);
const logger = consoleLogger({ scope: "example" });

const example = await createExampleServer({
  // Transport settings, set by the load test
  diff: process.env.DIFF as DiffName | undefined,
  checksums: process.env.CHECKSUMS === "1",
  socket: {
    ...(process.env.PARSER === "msgpack" ? { parser: msgpackParser } : {}),
    ...(process.env.DEFLATE
      ? { perMessageDeflate: { threshold: Number(process.env.DEFLATE) } }
      : {}),
  },
  databaseDirectory: process.cwd(),
  logger,
  publicDirectory,
});

const stop = async () => {
  await example.close();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
// From a parent process, such as the load test: on Windows, SIGTERM ends the
// process at once, before Node writes a CPU profile
// The CPU time used since the load test started measuring, so it can tell the
// server's work from its own
let measuredFrom: NodeJS.CpuUsage | undefined;
process.on("message", (message) => {
  if (message === "measure") measuredFrom = process.cpuUsage();
  if (message === "stop")
    process.send!({ cpu: process.cpuUsage(measuredFrom) }, () => void stop());
});

const port = await example.listen(Number(process.env.PORT ?? 3000));
logger.info(`Visit http://localhost:${port} to play tic-tac-toe`);
