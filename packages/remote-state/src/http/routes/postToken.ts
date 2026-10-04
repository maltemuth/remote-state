/**
 * `POST /api/tokens`: exchange an admission code from the host for a token
 * (decision 0020). The code goes in the body, never in the URL.
 */

import { type NextFunction, type Request, type Response } from 'express';
import { type EngineContext } from '../../engine/context.js';
import { redeemCode } from '../../engine/redeem.js';

export const postToken =
  (context: EngineContext) => async (req: Request, res: Response, next: NextFunction) => {
    try {
      const code = req.body?.code;
      if (typeof code !== 'string' || code.length === 0) {
        res.status(400).json({ error: 'A code is required' });
        return;
      }
      const result = await redeemCode(context, code);
      if ('invalid' in result) {
        res.status(401).json({ error: 'Invalid, used or expired code' });
      } else if ('refused' in result) {
        res.status(403).json({ error: result.refused });
      } else {
        res.status(201).json(result);
      }
    } catch (err) {
      next(err);
    }
  };
