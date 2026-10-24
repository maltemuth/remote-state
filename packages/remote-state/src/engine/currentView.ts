/**
 * A member's view of the latest state, with its sequence: what `GET …/state`
 * returns and what the socket sends on connect (decision 0031).
 */

import { Member } from '../database/entities/index.js';
import { effectiveAudience, viewFor } from '../plugin/views.js';
import { type EngineContext } from './context.js';
import { latestState } from './states.js';

export interface CurrentView {
  sequence: number;
  state: unknown;
}

/** Callers that must not miss an update between this read and the next hold the space's lock */
export const currentView = async (
  { orm, plugin }: Pick<EngineContext, 'orm' | 'plugin'>,
  spaceId: string,
  memberId: string
): Promise<CurrentView> => {
  const em = orm.em.fork();
  const current = await latestState(em, spaceId);
  const member = await em.findOne(Member, memberId);
  if (!current || !member) throw new Error(`No state for member ${memberId} in space ${spaceId}`);
  const audience = effectiveAudience(plugin, member);
  return { sequence: current.sequence, state: await viewFor(plugin, current.state, audience) };
};
