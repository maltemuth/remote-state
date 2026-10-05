/**
 * Reading stored game states.
 */

import { type EntityManager } from '@mikro-orm/sqlite';
import { GameState } from '../database/entities/index.js';

/** What the engine needs of a stored state */
export type StoredState = Pick<GameState, 'sequence' | 'state'>;

/** The latest state of a game, or null if the game doesn't exist */
export const latestState = (em: EntityManager, gameId: string): Promise<StoredState | null> =>
  em.findOne(GameState, { game: gameId }, { orderBy: { sequence: 'desc' } });

/** The state of a game at a sequence, or null if there's none */
export const stateAt = (
  em: EntityManager,
  gameId: string,
  sequence: number
): Promise<StoredState | null> => em.findOne(GameState, { game: gameId, sequence });
