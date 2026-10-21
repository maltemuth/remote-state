/**
 * `POST /api/games/:gameId/codes`: a single-use code for the authenticated player
 * themselves, to pair another device (decision 0063). Redeemed like any admission
 * code at `POST /api/tokens`, it gives a new token for the same player. Only
 * served when the host turns on `devicePairing`.
 */

import { type NextFunction, type Response } from 'express';
import { Player } from '../../database/entities/index.js';
import { type EngineContext } from '../../engine/context.js';
import { admit } from '../../server/host.js';
import { type GameRequest, playerOf } from '../authenticate.js';

export const postCode =
  (context: EngineContext) => async (req: GameRequest, res: Response, next: NextFunction) => {
    try {
      const player = await context.orm.em.fork().findOneOrFail(Player, playerOf(res));
      const code = await admit(context.orm, {
        gameId: req.params.gameId,
        identity: { id: player.identityId },
      });
      res.status(201).json({ code });
    } catch (err) {
      next(err);
    }
  };
