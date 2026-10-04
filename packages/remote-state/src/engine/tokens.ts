/**
 * Issuing tokens and resolving them to players (decisions 0015, 0017, 0019).
 */

import { Player, Token } from '../database/entities/index.js';
import { type Orm } from '../database/orm.js';
import { hashSecret, newSecret } from '../secrets.js';

export interface AuthenticatedPlayer {
  id: string;
  audience: string | null;
}

/** Create a new token for a player; only its hash is stored */
export const issueToken = async (orm: Orm, playerId: string): Promise<string> => {
  const token = newSecret();
  const em = orm.em.fork();
  em.create(Token, { player: playerId, tokenHash: hashSecret(token) });
  await em.flush();
  return token;
};

/** The player a token belongs to, if it belongs to this game */
export const authenticate = async (
  orm: Orm,
  token: unknown,
  gameId: unknown
): Promise<AuthenticatedPlayer | null> => {
  if (typeof token !== 'string' || typeof gameId !== 'string' || !token || !gameId) {
    return null;
  }
  const row = await orm.em
    .fork()
    .findOne(Token, { tokenHash: hashSecret(token) }, { populate: ['player'] });
  const player: Player | undefined = row?.player;
  return player && player.game.id === gameId ? { id: player.id, audience: player.audience } : null;
};
