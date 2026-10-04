/**
 * The host's side of the library, called in-process (decision 0023): creating games
 * from an initial state (0021, 0036), admitting people with single-use codes (0020),
 * and acting as the system (0040).
 */

import { AdmissionCode, Game, GameState } from '../database/entities/index.js';
import { type EntityManager } from '@mikro-orm/sqlite';
import { type Orm } from '../database/orm.js';
import { toJson } from '../json.js';
import { hashSecret, newSecret } from '../secrets.js';
import { act, type ActResult } from '../engine/act.js';
import { type EngineContext } from '../engine/context.js';
import { latestState } from '../engine/states.js';
import { SYSTEM } from '../plugin/system.js';
import { UnknownGameError } from './errors.js';

/** How long an admission code can be redeemed */
export const CODE_LIFETIME_MS = 60_000;

/** The host's identity for a person: an ID of its choosing, plus details for the game */
export interface Identity {
  id: string;
  [detail: string]: unknown;
}

export interface Admission {
  gameId: string;
  identity: Identity;
}

/** Store a new game with its initial state; returns the game's ID */
export const createGame = async (orm: Orm, initialState: unknown): Promise<string> => {
  if (initialState === undefined) throw new Error('An initial state is required');
  const em = orm.em.fork();
  const game = em.create(Game, {});
  em.create(GameState, { game, sequence: 0, state: toJson(initialState), actionType: 'initial' });
  await em.flush();
  return game.id;
};

/** Delete codes that can't be redeemed anymore, because they're used or expired */
const deleteSpentCodes = (em: EntityManager) =>
  em.nativeDelete(AdmissionCode, {
    $or: [{ usedAt: { $ne: null } }, { expiresAt: { $lt: new Date(Date.now()) } }],
  });

/** Issue a single-use code that admits this identity to the game, cleaning up spent codes */
export const admit = async (orm: Orm, { gameId, identity }: Admission): Promise<string> => {
  const { id: identityId, ...details } = identity ?? ({} as Identity);
  if (typeof identityId !== 'string' || identityId.length === 0) {
    throw new Error('An identity with a non-empty id is required');
  }
  const em = orm.em.fork();
  if (!(await em.findOne(Game, gameId))) throw new UnknownGameError(gameId);

  await deleteSpentCodes(em);
  const code = newSecret();
  em.create(AdmissionCode, {
    game: gameId,
    codeHash: hashSecret(code),
    identityId,
    details,
    expiresAt: new Date(Date.now() + CODE_LIFETIME_MS),
  });
  await em.flush();
  return code;
};

/** Run an action as the system, through the game's rules like any other action */
export const actAsSystem = async (
  context: EngineContext,
  gameId: string,
  action: unknown
): Promise<ActResult> => {
  if (!(await latestState(context.orm.em.fork(), gameId))) throw new UnknownGameError(gameId);
  return act(context, gameId, SYSTEM, action);
};
