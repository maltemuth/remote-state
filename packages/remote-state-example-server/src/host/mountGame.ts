/**
 * Mounts one game into the host's app under a prefix: the library's API at
 * `<prefix>/api`, the lobby at `<prefix>/lobby`, and the socket at
 * `<prefix>/socket.io`. Each game has its own Remote State instance and database.
 */

import type { Express } from "express";
import type { Server } from "http";
import {
  createRemoteState,
  type DiffName,
  type GamePlugin,
  type Logger,
  type RemoteState,
} from "@malte.muth/remote-state";
import { createLobby } from "./lobby.js";

export interface MountOptions {
  /** SQLite file for this game, or `:memory:` */
  database: string;
  logger: Logger;
  /** How patches are computed; the library's default if unset */
  diff?: DiffName;
}

export const mountGame = async <StateType, ActionType, ViewType>(
  app: Express,
  httpServer: Server,
  prefix: string,
  game: {
    plugin: GamePlugin<StateType, ActionType, ViewType>;
    newGame: () => StateType;
    /** The system action that resumes a game a restart paused */
    resume?: ActionType;
  },
  { database, logger, diff }: MountOptions,
): Promise<RemoteState<StateType>> => {
  const remote = await createRemoteState(game.plugin, {
    database,
    logger,
    diff,
    socket: { path: `${prefix}/socket.io` },
  });
  app.use(prefix, remote.router);
  app.use(`${prefix}/lobby`, createLobby(remote, game.newGame, game.resume));
  remote.attach(httpServer);
  return remote;
};
