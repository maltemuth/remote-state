/**
 * `GET /api/spaces/:spaceId/state`: the authenticated member's view of the latest
 * state, with its `sequence` (decision 0009).
 */

import { type NextFunction, type Response } from 'express';
import { type EngineContext } from '../../engine/context.js';
import { currentView } from '../../engine/currentView.js';
import { type SpaceRequest, memberOf } from '../authenticate.js';

export const getState =
  (context: EngineContext) => async (req: SpaceRequest, res: Response, next: NextFunction) => {
    try {
      const { spaceId } = req.params;
      const { sequence, state } = await currentView(context, spaceId, memberOf(res));
      res.json({ spaceId, sequence, state });
    } catch (err) {
      next(err);
    }
  };
