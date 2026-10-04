/**
 * Runs the tic-tac-toe example: the Remote State API, the example's lobby, and
 * the browser client served from ../public.
 */

import { createLogger } from "@malte.muth/remote-state";
import express from "express";
import path from "path";
import process from "process";
import { fileURLToPath } from "url";
import { createTicTacToeServer } from "./host/servers.js";

const publicDirectory = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../public",
);
const port = Number(process.env.PORT ?? 3000);
const { info } = createLogger({ scope: "example-server" });

const { app, startServer, shutdown } = await createTicTacToeServer(port, {
  persistDatabase: true,
});
app.use(express.static(publicDirectory));

process.on("SIGINT", () => shutdown());
process.on("SIGTERM", () => shutdown());

await startServer();
info(`Visit http://localhost:${port} to play`);
