/**
 * The Express app with the library's HTTP API. It has no endpoints for creating or
 * joining games (decision 0020) and no operational endpoints (0028); hosts add
 * their own routes to it.
 */

import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { type EngineContext } from '../engine/context.js';
import { createLogger } from '../utils/logger.js';
import { requirePlayer } from './authenticate.js';
import { getState } from './routes/getState.js';
import { getUpdates } from './routes/getUpdates.js';
import { postAction } from './routes/postAction.js';
import { postToken } from './routes/postToken.js';

export const createApp = (context: EngineContext) => {
  const { error } = createLogger({ scope: 'http' });
  const app = express();
  const player = requirePlayer(context.orm);

  app.use(cors());
  app.use(express.json());

  app.post('/api/tokens', postToken(context));
  app.post('/api/games/:gameId/actions', player, postAction(context));
  app.get('/api/games/:gameId/state', player, getState(context));
  app.get('/api/games/:gameId/updates', player, getUpdates(context));

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', game: context.plugin.gameConfig?.name ?? 'Unknown Game' });
  });

  // 404 for unknown API routes; other paths stay free for the host app
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'Endpoint not found' });
  });

  app.use((err: Error & { status?: number }, _req: Request, res: Response, _next: NextFunction) => {
    if (err.status && err.status < 500) {
      // For example, a request body that isn't valid JSON
      res.status(err.status).json({ error: err.message });
      return;
    }
    error('Server error:', { stack: err.stack });
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
};
