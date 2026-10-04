/**
 * Creates a Remote State server for one game: database, HTTP API, socket, and the
 * host API (`createGame`, `admit`) that the host app calls in-process.
 */

import { createServer } from 'http';
import { type Express } from 'express';
import { initializeDatabase } from '../database/orm.js';
import { type EngineContext, type Publisher } from '../engine/context.js';
import { createGameLock } from '../engine/gameLock.js';
import { createApp } from '../http/app.js';
import { type GamePlugin } from '../plugin/types.js';
import { createPublisher } from '../socket/publisher.js';
import { createSocketServer } from '../socket/server.js';
import { createLogger, setGlobalLogLevel } from '../utils/logger.js';
import { type Admission, admit, createGame } from './host.js';

export interface RemoteStateServer<StateType> {
  app: Express;
  server: ReturnType<typeof createServer>;
  port: number;
  /** Store a new game with an initial state the host got from the game (0036); returns its ID */
  createGame: (initialState: StateType) => Promise<string>;
  /** Issue a single-use code admitting an identity to a game (0020) */
  admit: (admission: Admission) => Promise<string>;
  startServer: () => Promise<void>;
  /** Close sockets, the HTTP server and the database; exits the process unless `andExit` is false */
  shutdown: (andExit?: boolean) => Promise<void>;
}

const noPublisher: Publisher = { publish: async () => undefined };

export const createRemoteStateServer = async <StateType, ActionType, ViewType>(
  plugin: GamePlugin<StateType, ActionType, ViewType>,
  port: number = 3000
): Promise<RemoteStateServer<StateType>> => {
  const configuration = plugin.serverConfiguration ?? {};
  if (configuration.minimumLogLevel !== undefined) {
    setGlobalLogLevel(configuration.minimumLogLevel);
  }
  const { info, error } = createLogger({ scope: 'remote-state-server' });

  const databasePath = configuration.persistDatabase
    ? configuration.databaseFilename || 'games.db'
    : ':memory:';
  const orm = await initializeDatabase(databasePath).catch(err => {
    throw new Error('Failed to initialize database', { cause: err });
  });

  const context: EngineContext = {
    orm,
    plugin,
    withGameLock: createGameLock(),
    publisher: noPublisher,
  };
  const app = createApp(context);
  const server = createServer(app);
  const io =
    configuration.socketIO?.enabled === false
      ? null
      : createSocketServer(server, context, configuration.socketIO);
  if (io) context.publisher = createPublisher(io, plugin);

  const startServer = () =>
    new Promise<void>(resolve => {
      server.listen(port, () => {
        info(`Remote State server listening at http://localhost:${port}`);
        resolve();
      });
    });

  const shutdown = async (andExit: boolean = true) => {
    info('Shutting down server...');
    try {
      if (io) {
        // Also closes the underlying HTTP server
        await new Promise<void>(resolve => io.close(() => resolve()));
      } else if (server.listening) {
        await new Promise<void>((resolve, reject) =>
          server.close(err => (err ? reject(err) : resolve()))
        );
      }
      await orm.close();
      if (andExit) process.exit(0);
    } catch (err) {
      error('Error during shutdown:', { error: err });
      if (andExit) process.exit(1);
    }
  };

  return {
    app,
    server,
    port,
    createGame: initialState => createGame(orm, initialState),
    admit: admission => admit(orm, admission),
    startServer,
    shutdown,
  };
};
