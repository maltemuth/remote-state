/**
 * `POST /api/spaces/:spaceId/actions`: run an action as the authenticated member.
 * Accepted actions answer 201 with their `sequence` (0034); the state itself
 * arrives over the socket.
 */

import { type NextFunction, type Response } from 'express';
import { dispatch } from '../../engine/dispatch.js';
import { type EngineContext } from '../../engine/context.js';
import { type SpaceRequest, memberOf } from '../authenticate.js';

export const postAction =
  (context: EngineContext) => async (req: SpaceRequest, res: Response, next: NextFunction) => {
    try {
      const action = req.body?.action;
      if (action === undefined) {
        res.status(400).json({ error: 'An action is required' });
        return;
      }
      const result = await dispatch(context, req.params.spaceId, memberOf(res), action);
      if ('rejected' in result) {
        res.status(400).json({ error: result.rejected });
        return;
      }
      res.status(201).json({ sequence: result.sequence });
    } catch (err) {
      next(err);
    }
  };
