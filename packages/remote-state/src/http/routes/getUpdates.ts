/**
 * `GET /api/games/:gameId/updates?since=<sequence>`: one patch from the player's
 * view at `since` to their current view (decisions 0029, 0030, 0035). Answers 404
 * for a `since` the player can't have had, and 303 to the state when no patch can
 * be built.
 */

import { type NextFunction, type Response } from 'express';
import { catchUp } from '../../engine/catchUp.js';
import { type EngineContext } from '../../engine/context.js';
import { type GameRequest, playerOf } from '../authenticate.js';

const parseSequence = (value: unknown): number | null =>
  typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : null;

export const getUpdates =
  (context: EngineContext) => async (req: GameRequest, res: Response, next: NextFunction) => {
    try {
      const { gameId } = req.params;
      const since = parseSequence(req.query.since);
      if (since === null) {
        res.status(400).json({ error: '`since` must be a sequence number' });
        return;
      }
      const result = await catchUp(context, gameId, playerOf(res), since);
      if ('notFound' in result) {
        res.status(404).json({ error: `No updates since ${since} for this player` });
      } else if ('seeState' in result) {
        // Relative to …/updates, so it also works where the app is mounted under a prefix
        res.redirect(303, 'state');
      } else {
        res.json({ gameId, since, ...result });
      }
    } catch (err) {
      next(err);
    }
  };
