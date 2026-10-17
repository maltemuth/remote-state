/**
 * The embeddable core of the library for one game: a router for the host's
 * Express app, a socket attached to the host's HTTP server, and the host API
 * (`createGame`, `admit`). Nothing here listens on a port or exits the process.
 */

import { type Server as HTTPServer } from 'http';
import { type Router } from 'express';
import { initializeDatabase } from '../database/orm.js';
import { type EngineContext } from '../engine/context.js';
import { createGameLock } from '../engine/gameLock.js';
import { createScheduler } from '../engine/scheduler.js';
import { restartGames } from '../engine/restart.js';
import { runDueTimer } from '../engine/timers.js';
import { createRouter } from '../http/router.js';
import { consoleLogger } from '../logging/logger.js';
import { type GamePlugin } from '../plugin/types.js';
import { createPublisher } from '../socket/publisher.js';
import { closeSocketServer, createSocketServer, type SocketServer } from '../socket/server.js';
import { act, type ActResult } from '../engine/act.js';
import { SYSTEM } from '../plugin/system.js';
import { type Admission, admit, createGame } from './host.js';
import { diffs } from '../patches/diff.js';
import { defaultCors, type RemoteStateOptions } from './options.js';

export interface RemoteState<StateType> {
  /** The HTTP API (`/api/…`), to mount in the host's Express app */
  router: Router;
  /** Serve the socket on the host's HTTP server; at most once, and not with `socket: false` */
  attach: (httpServer: HTTPServer) => void;
  /** Store a new game with an initial state the host got from the game (0036); returns its ID */
  createGame: (initialState: StateType) => Promise<string>;
  /** Issue a single-use code admitting an identity to a game (0020) */
  admit: (admission: Admission) => Promise<string>;
  /** Run an action as the system (0040); throws `UnknownGameError` for an unknown game */
  act: (gameId: string, action: unknown) => Promise<ActResult>;
  /** Disconnect clients and close the database. The host's HTTP server keeps running. */
  close: () => Promise<void>;
}

export const createRemoteState = async <StateType, ActionType, ViewType>(
  plugin: GamePlugin<StateType, ActionType, ViewType>,
  options: RemoteStateOptions = {}
): Promise<RemoteState<StateType>> => {
  const logger = options.logger ?? consoleLogger();
  const cors = options.cors ?? defaultCors;
  const diffName = options.diff ?? 'positional';
  if (!Object.hasOwn(diffs, diffName)) {
    throw new Error(`Unknown diff ${diffName}; use one of ${Object.keys(diffs).join(', ')}`);
  }
  const orm = await initializeDatabase(options.database ?? ':memory:', logger);

  const context: EngineContext = {
    orm,
    plugin,
    logger,
    withGameLock: createGameLock(),
    publisher: { publish: async () => undefined },
    scheduler: createScheduler(timer => runDueTimer(context, timer)),
    diff: diffs[diffName],
  };
  // Before anything is served, so no action can come in between (0052)
  await restartGames(context);
  let io: SocketServer | null = null;

  const attach = (httpServer: HTTPServer) => {
    if (options.socket === false) throw new Error('The socket is disabled');
    if (io) throw new Error('The socket is already attached');
    io = createSocketServer(httpServer, context, { cors, path: options.socket?.path });
    context.publisher = createPublisher(io, plugin, context.diff, logger);
  };

  return {
    router: createRouter(context, cors),
    attach,
    createGame: initialState => createGame(orm, logger, initialState),
    admit: admission => admit(orm, admission),
    act: (gameId, action) => act(context, gameId, SYSTEM, action),
    close: async () => {
      context.scheduler.close();
      if (io) closeSocketServer(io);
      await orm.close();
    },
  };
};
