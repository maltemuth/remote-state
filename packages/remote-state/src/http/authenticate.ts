/**
 * Express middleware that resolves `Authorization: Bearer <token>` to a member of
 * the space in the URL (decision 0017: the header is the only place for tokens).
 */

import { type NextFunction, type Request, type Response } from 'express';
import { type Orm } from '../database/orm.js';
import { authenticate } from '../engine/tokens.js';

export type SpaceRequest = Request<{ spaceId: string }>;

const bearerToken = (req: Request): string | undefined => {
  const header = req.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : undefined;
};

/** The authenticated member's ID, set by `requireMember` */
export const memberOf = (res: Response): string => res.locals.member;

export const requireMember =
  (orm: Orm) => async (req: SpaceRequest, res: Response, next: NextFunction) => {
    try {
      const member = await authenticate(orm, bearerToken(req), req.params.spaceId);
      if (!member) {
        res.status(401).json({ error: 'Invalid or missing token' });
        return;
      }
      res.locals.member = member;
      next();
    } catch (err) {
      next(err);
    }
  };
