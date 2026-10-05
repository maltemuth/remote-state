/**
 * Answers "what changed since sequence N" for a player, in one patch (decisions
 * 0030, 0035): stored diffs joined when the player stayed in one audience, a diff
 * computed from rebuilt views when they changed audience.
 */

import { AudienceDiff, AudienceMembership } from '../database/entities/index.js';
import { diff, type Patch } from '../patches/diff.js';
import { effectiveAudience, viewFor } from '../plugin/views.js';
import { type EngineContext } from './context.js';
import { latestState, stateAt } from './states.js';

export type CatchUpResult =
  | { sequence: number; patches: Patch[] }
  /** `since` is in the future, or before the player joined */
  | { notFound: true }
  /** No patch can be built; the client should fetch the whole state */
  | { seeState: true };

export const catchUp = (
  context: EngineContext,
  gameId: string,
  playerId: string,
  since: number
): Promise<CatchUpResult> =>
  context.withGameLock(gameId, async () => {
    const { orm, plugin } = context;
    const em = orm.em.fork();
    const current = await latestState(em, gameId);
    const memberships = await em.find(
      AudienceMembership,
      { player: playerId },
      { orderBy: { sequence: 'asc' } }
    );
    if (!current || since > current.sequence || !(memberships[0]?.sequence <= since)) {
      return { notFound: true };
    }
    const sequence = current.sequence;
    if (since === sequence) return { sequence, patches: [] };

    // Every join and audience change records a membership, so the last is the current one
    const audience = effectiveAudience(plugin, {
      id: playerId,
      audience: memberships.at(-1)!.audience,
    });
    if (!memberships.some(membership => membership.sequence > since)) {
      const diffs = await em.find(
        AudienceDiff,
        { game: gameId, audience, sequence: { $gt: since } },
        { orderBy: { sequence: 'asc' } }
      );
      if (diffs.length === sequence - since) {
        return { sequence, patches: diffs.flatMap(row => row.patches as Patch[]) };
      }
    }

    // The audience changed (or diffs are missing): rebuild the view the client has
    const base = await stateAt(em, gameId, since);
    if (!base) return { seeState: true };
    const then = memberships.filter(membership => membership.sequence <= since).at(-1)!;
    const baseAudience = effectiveAudience(plugin, { id: playerId, audience: then.audience });
    const baseView = await viewFor(plugin, base.state, baseAudience);
    return { sequence, patches: diff(baseView, await viewFor(plugin, current.state, audience)) };
  });
