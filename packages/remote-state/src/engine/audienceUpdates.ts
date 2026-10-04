/**
 * Audience bookkeeping for a transition: who is in which audience before and after,
 * and each audience's new view and patches.
 */

import { diff } from '../patches/diff.js';
import { type AudienceChanges } from '../plugin/transition.js';
import { type AnyGamePlugin } from '../plugin/types.js';
import { effectiveAudience, viewFor } from '../plugin/views.js';
import { type AudienceUpdate } from './context.js';

/** Player ID → stored audience (null for the default) */
export type StoredAudiences = Map<string, string | null>;

/** Apply a game's audience changes, rejecting changes for players the game doesn't have */
export const applyAudienceChanges = (
  stored: StoredAudiences,
  changes: AudienceChanges
): StoredAudiences => {
  const result = new Map(stored);
  for (const [playerId, audience] of Object.entries(changes)) {
    if (!result.has(playerId)) {
      throw new Error(`Audience change for unknown player ${playerId}`);
    }
    result.set(playerId, audience);
  }
  return result;
};

/** Player ID → effective audience */
export const effectiveAudiences = (
  plugin: AnyGamePlugin,
  stored: StoredAudiences
): Map<string, string> =>
  new Map([...stored].map(([id, audience]) => [id, effectiveAudience(plugin, { id, audience })]));

/** Each audience's view of the new state, and the patches from its view of the previous one */
export const computeAudienceUpdates = async (
  plugin: AnyGamePlugin,
  previousState: unknown,
  nextState: unknown,
  audiences: Iterable<string>
): Promise<Map<string, AudienceUpdate>> => {
  const updates = new Map<string, AudienceUpdate>();
  for (const audience of new Set(audiences)) {
    const before = await viewFor(plugin, previousState, audience);
    const view = await viewFor(plugin, nextState, audience);
    updates.set(audience, { view, patches: diff(before, view) });
  }
  return updates;
};
