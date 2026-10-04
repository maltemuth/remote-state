/**
 * Reading stored game states.
 */

import { type EntityManager } from '@mikro-orm/sqlite';
import { GameState } from '../database/entities/index.js';

export interface StoredState {
  sequence: number;
  state: unknown;
}

const toStored = (row: GameState | null): StoredState | null =>
  row ? { sequence: row.sequence, state: row.state } : null;

/** The latest state of a game, or null if the game doesn't exist */
export const latestState = async (em: EntityManager, gameId: string) =>
  toStored(await em.findOne(GameState, { game: gameId }, { orderBy: { sequence: 'desc' } }));

/** The state of a game at a sequence, or null if there's none */
export const stateAt = async (em: EntityManager, gameId: string, sequence: number) =>
  toStored(await em.findOne(GameState, { game: gameId, sequence }));
