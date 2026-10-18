/**
 * The example host: one Express app and HTTP server serving both example games,
 * tic-tac-toe under /tic-tac-toe and battleship under /battleship, plus the
 * browser client.
 */

import express, { type Express } from "express";
import { createServer, type Server } from "http";
import {
  consoleLogger,
  type DiffName,
  type Logger,
  type RemoteState,
  type SocketSettings,
} from "@malte.muth/remote-state";
import {
  battleshipPlugin,
  newBattleshipGame,
} from "../games/battleship/plugin.js";
import type { BattleshipState } from "../games/battleship/types.js";
import { newTicTacToeGame } from "../games/tic-tac-toe/rules.js";
import { ticTacToePlugin } from "../games/tic-tac-toe/plugin.js";
import type { TicTacToeState } from "../games/tic-tac-toe/types.js";
import { serveBrowserModules } from "./browserModules.js";
import { mountGame } from "./mountGame.js";

/** Seconds per tic-tac-toe move before the player to move loses */
export const TURN_SECONDS = 60;

export interface ExampleServerOptions {
  /** Keep games in `tic-tac-toe.db` and `battleship.db` in this directory; in memory if unset */
  databaseDirectory?: string;
  logger?: Logger;
  /** Serve static files from this directory, for example the browser client */
  publicDirectory?: string;
  /** How patches are computed; the library's default if unset */
  diff?: DiffName;
  /** Send checksums with patches */
  checksums?: boolean;
  /** The socket's parser and compression */
  socket?: Omit<SocketSettings, "path">;
}

export interface ExampleServer {
  app: Express;
  server: Server;
  ticTacToe: RemoteState<TicTacToeState>;
  battleship: RemoteState<BattleshipState>;
  /** Listen; resolves with the port */
  listen: (port: number) => Promise<number>;
  close: () => Promise<void>;
}

export const createExampleServer = async ({
  databaseDirectory,
  logger = consoleLogger(),
  diff,
  checksums,
  socket,
  publicDirectory,
}: ExampleServerOptions = {}): Promise<ExampleServer> => {
  const app = express();
  const server = createServer(app);
  const database = (name: string) =>
    databaseDirectory ? `${databaseDirectory}/${name}.db` : ":memory:";

  const ticTacToe = await mountGame(
    app,
    server,
    "/tic-tac-toe",
    {
      plugin: ticTacToePlugin,
      newGame: () => newTicTacToeGame({ turnSeconds: TURN_SECONDS }),
      resume: { type: "resume" },
    },
    { database: database("tic-tac-toe"), logger, diff, checksums, socket },
  );
  const battleship = await mountGame(
    app,
    server,
    "/battleship",
    { plugin: battleshipPlugin, newGame: newBattleshipGame },
    { database: database("battleship"), logger, diff, checksums, socket },
  );
  if (publicDirectory) {
    app.use(express.static(publicDirectory));
    app.use(serveBrowserModules());
  }

  const listen = (port: number) =>
    new Promise<number>((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, () => {
        server.off("error", reject);
        resolve((server.address() as { port: number }).port);
      });
    });

  const close = async () => {
    await Promise.all([ticTacToe.close(), battleship.close()]);
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  };

  return { app, server, ticTacToe, battleship, listen, close };
};
