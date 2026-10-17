/**
 * Audience bookkeeping for a transition: who is in which audience before and after.
 */

import { type AudienceChanges } from '../plugin/transition.js';
import { type AnyGamePlugin } from '../plugin/types.js';
import { effectiveAudience } from '../plugin/views.js';

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
