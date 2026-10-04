/**
 * Express middleware that resolves `Authorization: Bearer <token>` to a player of
 * the game in the URL (decision 0017: the header is the only place for tokens).
 */

import { type NextFunction, type Request, type Response } from 'express';
import { type Orm } from '../database/orm.js';
import { authenticate, type AuthenticatedPlayer } from '../engine/tokens.js';

export type GameRequest = Request<{ gameId: string }>;

const bearerToken = (req: Request): string | undefined => {
  const header = req.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : undefined;
};

/** The authenticated player, set by `requirePlayer` */
export const playerOf = (res: Response): AuthenticatedPlayer => res.locals.player;

export const requirePlayer =
  (orm: Orm) => async (req: GameRequest, res: Response, next: NextFunction) => {
    try {
      const player = await authenticate(orm, bearerToken(req), req.params.gameId);
      if (!player) {
        res.status(401).json({ error: 'Invalid or missing token' });
        return;
      }
      res.locals.player = player;
      next();
    } catch (err) {
      next(err);
    }
  };
