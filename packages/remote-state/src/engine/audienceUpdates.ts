/**
 * Audience bookkeeping for a transition: who is in which audience before and after.
 */

import { type AudienceChanges } from '../plugin/transition.js';
import { type AnyRules } from '../plugin/types.js';
import { effectiveAudience } from '../plugin/views.js';

/** Member ID → stored audience (null for the default) */
export type StoredAudiences = Map<string, string | null>;

/** Apply a space's audience changes, rejecting changes for members the space doesn't have */
export const applyAudienceChanges = (
  stored: StoredAudiences,
  changes: AudienceChanges
): StoredAudiences => {
  const result = new Map(stored);
  for (const [memberId, audience] of Object.entries(changes)) {
    if (!result.has(memberId)) {
      throw new Error(`Audience change for unknown member ${memberId}`);
    }
    result.set(memberId, audience);
  }
  return result;
};

/** Member ID → effective audience */
export const effectiveAudiences = (
  plugin: AnyRules,
  stored: StoredAudiences
): Map<string, string> =>
  new Map([...stored].map(([id, audience]) => [id, effectiveAudience(plugin, { id, audience })]));
