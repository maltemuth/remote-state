import express, { Express, Request, Response, NextFunction } from 'express';
import { GamePlugin } from './types';

import cors from 'cors';
import { createServer } from 'http';
import { createLogger, LogLevel, setGlobalLogLevel } from '../utils/logger';
import { initializeDatabase } from '../database/instance';
import { SocketIOManager } from './socket';

import { getState } from './routes/getState';
import { postAction } from './routes/postAction';
import { postGame } from './routes/postGame';
import { postPlayer } from './routes/postPlayer';

import * as process from 'process';
import { createDatabaseService } from '../database/service';

export interface RemoteStateServer<StateType, ActionType, PlayerStateType> {
  app: Express;
  server: ReturnType<typeof createServer>;
  socketIOManager?: SocketIOManager<StateType, ActionType, PlayerStateType>;
  startServer: () => Promise<void>;
  shutdown: (andExit?: boolean) => Promise<void>;
  port: number;
}

export interface RemoteStateServerConfiguration {
  minimumLogLevel?: LogLevel;
  /** Database persistence configuration */
  persistDatabase?: boolean;
  databaseFilename?: string;
  /** Socket.IO server configuration */
  socketIO?: {
    enabled?: boolean;
    cors?: {
      origin: string | string[];
      methods: string[];
    };
  };
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
  const database = await initializeDatabase(
    { databasePath, sync: true },
    plugin.serverConfiguration
  ).catch(err => {
    throw new Error('Failed to initialize database:', err);
  });
  const databaseService = createDatabaseService<StateType, ActionType, PlayerStateType>(database);

  const app = express();

  // Create HTTP server
  const server = createServer(app);

  // Socket.IO Manager
  let socketIOManager: SocketIOManager<StateType, ActionType, PlayerStateType> | null = null;
  if (plugin.serverConfiguration?.socketIO?.enabled !== false) {
    // Create authenticatePlayer function that uses the database service
    const authenticatePlayer = async (playerId: string, token: string, gameId: string) => {
      const player = await databaseService.getPlayerByToken(token);
      const game = await databaseService.getGame(gameId);
      if (!player || !game || player.gameId !== game.id || player.id !== player.id) {
        return null;
      }
      return { player, game };
    };

    socketIOManager = new SocketIOManager<StateType, ActionType, PlayerStateType>(
      server,
      authenticatePlayer,
      plugin,
      plugin.serverConfiguration?.socketIO
    );
  }

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Action submission endpoint
  app.post('/api/games/:gameId/actions', postAction(databaseService, plugin, socketIOManager));

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

  // 404 handler
  app.use((req: Request, res: Response) => {
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

  // Graceful shutdown handling
  const shutdown = async (andExit: boolean = true) => {
    info('Shutting down server...');
    try {
      // Close database connections
      await database.close();
      // Close HTTP server
      await new Promise<void>((resolve, reject) => {
        server.close(err => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
      info('Server shut down successfully');
      if (andExit) process.exit(0);
    } catch (_error) {
      error('Error during shutdown:', { _error });
      if (andExit) process.exit(1);
    }
  };

  // Listen for shutdown signals only in Node.js environment (not in tests)
  if (typeof process !== 'undefined' && process.on) {
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  }

  return {
    app,
    server,
    socketIOManager,
    startServer,
    shutdown,
    port,
  };
};
