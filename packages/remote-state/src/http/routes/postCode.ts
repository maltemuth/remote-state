/**
 * `POST /api/spaces/:spaceId/codes`: a single-use code for the authenticated member
 * themselves, to pair another device (decision 0063). Redeemed like any admission
 * code at `POST /api/tokens`, it gives a new token for the same member. Only
 * served when the host turns on `devicePairing`.
 */

import { type NextFunction, type Response } from 'express';
import { Member } from '../../database/entities/index.js';
import { type EngineContext } from '../../engine/context.js';
import { admit } from '../../server/host.js';
import { type SpaceRequest, memberOf } from '../authenticate.js';

export const postCode =
  (context: EngineContext) => async (req: SpaceRequest, res: Response, next: NextFunction) => {
    try {
      const member = await context.orm.em.fork().findOneOrFail(Member, memberOf(res));
      const code = await admit(context.orm, {
        spaceId: req.params.spaceId,
        identity: { id: member.identityId },
      });
      res.status(201).json({ code });
    } catch (err) {
      next(err);
    }
  };
