/**
 * The library's HTTP API as an Express router, which a host mounts in its own app
 * or the standalone server mounts in a new one. It has no endpoints for creating
 * or joining games (decision 0020), and its only operational endpoint is a health
 * check (0049). Everything it serves is under `/api`.
 */

import cors, { type CorsOptions } from 'cors';
import express, { type NextFunction, type Request, type Response, Router } from 'express';
import { type EngineContext } from '../engine/context.js';
import { requirePlayer } from './authenticate.js';
import { getState } from './routes/getState.js';
import { getUpdates } from './routes/getUpdates.js';
import { postAction } from './routes/postAction.js';
import { postToken } from './routes/postToken.js';

export const createRouter = (context: EngineContext, corsOptions: CorsOptions) => {
  const router = Router();
  const player = requirePlayer(context.orm);

  router.use('/api', cors(corsOptions));
  router.use('/api', express.json());
  router.post('/api/tokens', postToken(context));
  router.post('/api/games/:gameId/actions', player, postAction(context));
  router.get('/api/games/:gameId/state', player, getState(context));
  router.get('/api/games/:gameId/updates', player, getUpdates(context));
  router.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', game: context.plugin.gameConfig?.name ?? 'Unknown Game' });
  });

  // 404 for unknown API routes; other paths stay free for the host
  router.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'Endpoint not found' });
  });

  // Handles errors from the library's routes only
  router.use(
    '/api',
    (err: Error & { status?: number }, _req: Request, res: Response, _next: NextFunction) => {
      if (err.status && err.status < 500) {
        // For example, a request body that isn't valid JSON
        res.status(err.status).json({ error: err.message });
        return;
      }
      context.logger.error('Server error', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  );

  return router;
};
