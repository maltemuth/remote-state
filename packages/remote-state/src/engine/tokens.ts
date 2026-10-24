/**
 * Issuing tokens and resolving them to members (decisions 0015, 0017, 0019).
 */

import { Member, Token } from '../database/entities/index.js';
import { type Orm } from '../database/orm.js';
import { hashSecret, newSecret } from '../secrets.js';

/** Create a new token for a member; only its hash is stored */
export const issueToken = async (orm: Orm, memberId: string): Promise<string> => {
  const token = newSecret();
  const em = orm.em.fork();
  em.create(Token, { member: memberId, tokenHash: hashSecret(token) });
  await em.flush();
  return token;
};

/** The ID of the member a token belongs to, if it belongs to this space */
export const authenticate = async (
  orm: Orm,
  token: unknown,
  spaceId: unknown
): Promise<string | null> => {
  if (typeof token !== 'string' || typeof spaceId !== 'string' || !token || !spaceId) {
    return null;
  }
  const row = await orm.em
    .fork()
    .findOne(Token, { tokenHash: hashSecret(token) }, { populate: ['member'] });
  const member: Member | undefined = row?.member;
  return member && member.space.id === spaceId ? member.id : null;
};
