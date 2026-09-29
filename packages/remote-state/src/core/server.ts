import express, { Express, Request, Response, NextFunction } from 'express';
import { GamePlugin, RemoteStateServerConfiguration } from './types.js';

import cors from 'cors';
import { createServer } from 'http';
import { createLogger, LogLevel, setGlobalLogLevel } from '../utils/logger.js';
import { initializeDatabase } from '../database/instance.js';
import { createSocketManager, SocketManager } from './socket.js';
import { createGameLock } from './gameLock.js';

import { getState } from './routes/getState.js';
import { postAction } from './routes/postAction.js';
import { postGame } from './routes/postGame.js';
import { postPlayer } from './routes/postPlayer.js';
import * as process from 'process';
import { createDatabaseService } from '../database/service.js';

export type { RemoteStateServerConfiguration };

export interface RemoteStateServer<_StateType, _ActionType, PlayerStateType> {
  app: Express;
  server: ReturnType<typeof createServer>;
  socketIOManager: SocketManager<PlayerStateType> | null;
  startServer: () => Promise<void>;
  /** Close sockets, the HTTP server and the database; exits the process unless `andExit` is false */
  shutdown: (andExit?: boolean) => Promise<void>;
  port: number;
}

export const createRemoteStateServer = async <StateType, ActionType, PlayerStateType>(
  plugin: GamePlugin<StateType, ActionType, PlayerStateType>,
  port: number = 3000
): Promise<RemoteStateServer<StateType, ActionType, PlayerStateType>> => {
  // Set global log level from configuration
  if (plugin.serverConfiguration?.minimumLogLevel !== undefined) {
    setGlobalLogLevel(plugin.serverConfiguration.minimumLogLevel);
  }

  const { info, error } = createLogger({
    scope: 'remote-state-server',
  });

  const databasePath = plugin.serverConfiguration?.persistDatabase
    ? plugin.serverConfiguration?.databaseFilename || 'games.db'
    : ':memory:';
  const database = await initializeDatabase({ databasePath, sync: true }).catch(err => {
    throw new Error('Failed to initialize database', { cause: err });
  });
  const databaseService = createDatabaseService<StateType, ActionType>(database);
  const withGameLock = createGameLock();

  const app = express();

  // Create HTTP server
  const server = createServer(app);

  // Socket.IO Manager
  let socketIOManager: SocketManager<PlayerStateType> | null = null;
  if (plugin.serverConfiguration?.socketIO?.enabled !== false) {
    socketIOManager = createSocketManager<PlayerStateType>(
      server,
      databaseService.authenticatePlayer,
      plugin.serverConfiguration?.socketIO
    );
  }

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Action submission endpoint
  app.post(
    '/api/games/:gameId/actions',
    postAction(databaseService, plugin, withGameLock, socketIOManager)
  );

  // Current state retrieval endpoint
  app.get('/api/games/:gameId/state/:cursor', getState(databaseService, plugin));

  // Self-register as game owner endpoint
  app.post('/api/games', postGame(databaseService, plugin));

  // Self-register as joining player endpoint
  app.post('/api/games/:gameId/players', postPlayer(databaseService, plugin, socketIOManager));

  // Health check endpoint
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      game: plugin.gameConfig?.name || 'Unknown Game',
    });
  });

  // Runtime log level adjustment endpoint (development only)
  if (process.env.NODE_ENV !== 'production') {
    app.post('/admin/log-level', (req: Request, res: Response) => {
      const { level } = req.body;
      if (level !== undefined && LogLevel[level] !== undefined) {
        const logLevel = LogLevel[level as keyof typeof LogLevel];
        setGlobalLogLevel(logLevel);
        info(`Log level changed to: ${level}`);
        res.json({ success: true, message: `Log level set to ${level}` });
      } else {
        res.status(400).json({
          success: false,
          message: 'Invalid log level. Valid levels: debug, info, warn, error',
        });
      }
    });
  }

  // Error handling middleware
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    error('Server error:', { stack: err.stack });
    res.status(500).json({ error: 'Internal Server Error' });
  });

  // 404 for unknown API routes; other paths stay free for the host app (e.g. static files)
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'Endpoint not found' });
  });

  // Helper function to start the server
  const startServer = () =>
    new Promise<void>(resolve => {
      server.listen(port, () => {
        info(`Remote State server listening at http://localhost:${port}`);
        info(`Game: ${plugin.gameConfig?.name || 'Unknown Game'}`);
        resolve();
      });
    });

  const shutdown = async (andExit: boolean = true) => {
    info('Shutting down server...');
    try {
      if (socketIOManager) {
        // Also closes the underlying HTTP server
        await socketIOManager.close();
      } else if (server.listening) {
        await new Promise<void>((resolve, reject) =>
          server.close(err => (err ? reject(err) : resolve()))
        );
      }
      await database.close();
      info('Server shut down successfully');
      if (andExit) process.exit(0);
    } catch (err) {
      error('Error during shutdown:', { error: err });
      if (andExit) process.exit(1);
    }
  };

  return {
    app,
    server,
    socketIOManager,
    startServer,
    shutdown,
    port,
  };
};
