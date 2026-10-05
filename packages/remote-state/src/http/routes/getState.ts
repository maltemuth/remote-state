/**
 * `GET /api/games/:gameId/state`: the authenticated player's view of the latest
 * state, with its `sequence` (decision 0009).
 */

import { type NextFunction, type Response } from 'express';
import { type EngineContext } from '../../engine/context.js';
import { currentView } from '../../engine/currentView.js';
import { type GameRequest, playerOf } from '../authenticate.js';

export const getState =
  (context: EngineContext) => async (req: GameRequest, res: Response, next: NextFunction) => {
    try {
      const { gameId } = req.params;
      const { sequence, state } = await currentView(context, gameId, playerOf(res));
      res.json({ gameId, sequence, state });
    } catch (err) {
      next(err);
    }
  };
