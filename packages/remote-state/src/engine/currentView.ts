/**
 * A player's view of the latest state, with its sequence: what `GET …/state`
 * returns and what the socket sends on connect (decision 0031).
 */

import { Player } from '../database/entities/index.js';
import { effectiveAudience, viewFor } from '../plugin/views.js';
import { type EngineContext } from './context.js';
import { latestState } from './states.js';

export interface CurrentView {
  sequence: number;
  state: unknown;
}

/** Callers that must not miss an update between this read and the next hold the game's lock */
export const currentView = async (
  { orm, plugin }: Pick<EngineContext, 'orm' | 'plugin'>,
  gameId: string,
  playerId: string
): Promise<CurrentView> => {
  const em = orm.em.fork();
  const current = await latestState(em, gameId);
  const player = await em.findOne(Player, playerId);
  if (!current || !player) throw new Error(`No state for player ${playerId} in game ${gameId}`);
  const audience = effectiveAudience(plugin, player);
  return { sequence: current.sequence, state: await viewFor(plugin, current.state, audience) };
};
