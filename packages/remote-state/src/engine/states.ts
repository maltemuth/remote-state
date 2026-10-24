/**
 * Reading stored space states.
 */

import { type EntityManager } from '@mikro-orm/sqlite';
import { SpaceState } from '../database/entities/index.js';

/** What the engine needs of a stored state */
export type StoredState = Pick<SpaceState, 'sequence' | 'state'>;

/** The latest state of a space, or null if the space doesn't exist */
export const latestState = (em: EntityManager, spaceId: string): Promise<StoredState | null> =>
  em.findOne(SpaceState, { space: spaceId }, { orderBy: { sequence: 'desc' } });

/** The state of a space at a sequence, or null if there's none */
export const stateAt = (
  em: EntityManager,
  spaceId: string,
  sequence: number
): Promise<StoredState | null> => em.findOne(SpaceState, { space: spaceId, sequence });
