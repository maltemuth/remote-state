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
import { createRouter } from '../http/router.js';
import { consoleLogger } from '../logging/logger.js';
import { type GamePlugin } from '../plugin/types.js';
import { createPublisher } from '../socket/publisher.js';
import { closeSocketServer, createSocketServer, type SocketServer } from '../socket/server.js';
import { type Admission, admit, createGame } from './host.js';
import { defaultCors, type RemoteStateOptions } from './options.js';

export interface RemoteState<StateType> {
  /** The HTTP API (`/api/…`, `/health`), to mount in the host's Express app */
  router: Router;
  /** Serve the socket on the host's HTTP server; at most once, and not with `socket: false` */
  attach: (httpServer: HTTPServer) => void;
  /** Store a new game with an initial state the host got from the game (0036); returns its ID */
  createGame: (initialState: StateType) => Promise<string>;
  /** Issue a single-use code admitting an identity to a game (0020) */
  admit: (admission: Admission) => Promise<string>;
  /** Disconnect clients and close the database. The host's HTTP server keeps running. */
  close: () => Promise<void>;
}

export const createRemoteState = async <StateType, ActionType, ViewType>(
  plugin: GamePlugin<StateType, ActionType, ViewType>,
  options: RemoteStateOptions = {}
): Promise<RemoteState<StateType>> => {
  const logger = options.logger ?? consoleLogger();
  const cors = options.cors ?? defaultCors;
  const orm = await initializeDatabase(options.database ?? ':memory:', logger).catch(err => {
    throw new Error('Failed to initialize database', { cause: err });
  });

  const context: EngineContext = {
    orm,
    plugin,
    logger,
    withGameLock: createGameLock(),
    publisher: { publish: async () => undefined },
  };
  let io: SocketServer | null = null;

  const attach = (httpServer: HTTPServer) => {
    if (options.socket === false) throw new Error('The socket is disabled');
    if (io) throw new Error('The socket is already attached');
    io = createSocketServer(httpServer, context, { cors, path: options.socket?.path });
    context.publisher = createPublisher(io, plugin, logger);
  };

  return {
    router: createRouter(context, cors),
    attach,
    createGame: initialState => createGame(orm, initialState),
    admit: admission => admit(orm, admission),
    close: async () => {
      if (io) closeSocketServer(io);
      await orm.close();
    },
  };
};
