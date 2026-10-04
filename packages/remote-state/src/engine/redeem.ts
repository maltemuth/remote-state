/**
 * Exchanges a single-use admission code for a token (decision 0020): the code is
 * used up first, then the player is found or joins, then a new token is issued.
 */

import { AdmissionCode } from '../database/entities/index.js';
import { hashSecret } from '../secrets.js';
import { type EngineContext } from './context.js';
import { joinGame } from './join.js';
import { issueToken } from './tokens.js';

export type RedeemResult =
  { gameId: string; playerId: string; token: string } | { invalid: true } | { refused: string };

export const redeemCode = async (context: EngineContext, code: string): Promise<RedeemResult> => {
  const em = context.orm.em.fork();
  const admission = await em.findOne(AdmissionCode, { codeHash: hashSecret(code) });
  if (!admission || admission.usedAt || admission.expiresAt.getTime() < Date.now()) {
    return { invalid: true };
  }

  // Claim the code atomically, so it can't be redeemed twice
  const claimed = await em.nativeUpdate(
    AdmissionCode,
    { id: admission.id, usedAt: null },
    { usedAt: new Date() }
  );
  if (claimed === 0) return { invalid: true };

  const gameId = admission.game.id;
  const joined = await joinGame(context, gameId, admission.identityId, admission.details);
  if ('refused' in joined) return joined;

  const token = await issueToken(context.orm, joined.playerId);
  return { gameId, playerId: joined.playerId, token };
};
