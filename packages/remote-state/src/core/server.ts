import express, { Express, Request, Response, NextFunction } from 'express';
import { GamePlugin } from './types';

import cors from 'cors';
import { createServer } from 'http';
import { createLogger } from '../utils/logger';
import { initializeDatabase, closeDatabase } from '../database/instance';

import { getState } from './routes/getState';
import { postAction } from './routes/postAction';
import { postGame } from './routes/postGame';
import { postPlayer } from './routes/postPlayer';

import * as process from 'process';

export interface RemoteStateServer {
  app: Express;
  server: ReturnType<typeof createServer>;
  startServer: () => void;
  shutdown: () => Promise<void>;
  port: number;
}

export const createRemoteStateServer = async <StateType, ActionType>(
  plugin: GamePlugin<StateType, ActionType>,
  port: number = 3000
): Promise<RemoteStateServer> => {
  const { info, error } = createLogger({
    scope: 'remote-state-server',
  });

  const databasePath = plugin.persistDatabase ? plugin.databaseFilename || 'games.db' : ':memory:';
  const database = await initializeDatabase({ databasePath, sync: true }).catch(err => {
    throw new Error('Failed to initialize database:', err);
  });

  const app = express();

  // Create HTTP server
  const server = createServer(app);

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Action submission endpoint
  app.post('/api/games/:gameId/actions', postAction(app, database, plugin));

  // Current state retrieval endpoint
  app.get('/api/games/:gameId/state/:cursor', getState(app, database, plugin));

  // Self-register as game owner endpoint
  app.post('/api/games', postGame(app, database, plugin));

  // Self-register as joining player endpoint
  app.post('/api/games/:gameId/players', postPlayer(app, database, plugin));

  // Health check endpoint
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      game: plugin.gameConfig?.name || 'Unknown Game',
    });
  });

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
  const startServer = () => {
    server.listen(port, () => {
      info(`Remote State server listening at http://localhost:${port}`);
      info(`Game: ${plugin.gameConfig?.name || 'Unknown Game'}`);
    });
  };

  // Graceful shutdown handling
  const shutdown = async () => {
    info('Shutting down server...');
    try {
      // Close database connections
      await closeDatabase();
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
      process.exit(0);
    } catch (_error) {
      error('Error during shutdown:', { _error });
      process.exit(1);
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
    startServer,
    shutdown,
    port,
  };
};
