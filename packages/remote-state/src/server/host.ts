/**
 * The host's side of the library, called in-process (decision 0023): creating spaces
 * from an initial state (0021, 0036), and admitting people with single-use codes
 * (0020). Acting as the system (0040) is `dispatch` with the member `SYSTEM`.
 */

import { AdmissionCode, Space, SpaceState } from '../database/entities/index.js';
import { type EntityManager } from '@mikro-orm/sqlite';
import { type Orm } from '../database/orm.js';
import { droppedKeysWarning, toJson } from '../json.js';
import { type Logger } from '../logging/logger.js';
import { hashSecret, newSecret } from '../secrets.js';
import { UnknownSpaceError } from './errors.js';

/** How long an admission code can be redeemed */
export const CODE_LIFETIME_MS = 60_000;

/** The host's identity for a person: an ID of its choosing, plus details for the space */
export interface Identity {
  id: string;
  [detail: string]: unknown;
}

export interface Admission {
  spaceId: string;
  identity: Identity;
}

/** Store a new space with its initial state; returns the space's ID */
export const createSpace = async (
  orm: Orm,
  logger: Logger,
  initialState: unknown
): Promise<string> => {
  if (initialState === undefined) throw new Error('An initial state is required');
  const em = orm.em.fork();
  const space = em.create(Space, {});
  const state = toJson(initialState, keys => logger.warn(droppedKeysWarning(keys, space.id, 0)));
  em.create(SpaceState, { space, sequence: 0, state, actionType: 'initial' });
  await em.flush();
  return space.id;
};

/** Delete codes that can't be redeemed anymore, because they're used or expired */
const deleteSpentCodes = (em: EntityManager) =>
  em.nativeDelete(AdmissionCode, {
    $or: [{ usedAt: { $ne: null } }, { expiresAt: { $lt: new Date(Date.now()) } }],
  });

/** Issue a single-use code that admits this identity to the space, cleaning up spent codes */
export const admit = async (orm: Orm, { spaceId, identity }: Admission): Promise<string> => {
  const { id: identityId, ...details } = identity ?? ({} as Identity);
  if (typeof identityId !== 'string' || identityId.length === 0) {
    throw new Error('An identity with a non-empty id is required');
  }
  const em = orm.em.fork();
  if (!(await em.findOne(Space, spaceId))) throw new UnknownSpaceError(spaceId);

  await deleteSpentCodes(em);
  const code = newSecret();
  em.create(AdmissionCode, {
    space: spaceId,
    codeHash: hashSecret(code),
    identityId,
    details,
    expiresAt: new Date(Date.now() + CODE_LIFETIME_MS),
  });
  await em.flush();
  return code;
};
