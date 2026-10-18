/**
 * Answers "what changed since sequence N" for a player, in one patch (decisions
 * 0030, 0035, 0056): the diff between their view of the stored state at `since`,
 * in the audience they were in then, and their view of the current one, with the
 * checksum of that view unless the `checksums` option is off (0059, 0061).
 */

import { AudienceMembership } from '../database/entities/index.js';
import { checksumOf } from '../patches/checksum.js';
import { type Patch } from '../patches/diff.js';
import { effectiveAudience, viewFor } from '../plugin/views.js';
import { type EngineContext } from './context.js';
import { latestState, stateAt } from './states.js';

export type CatchUpResult =
  | { sequence: number; patches: Patch[]; checksum?: number }
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
    const { orm, plugin, diff, checksums } = context;
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
    // Every join and audience change records a membership, so the last is the current one
    const audience = effectiveAudience(plugin, {
      id: playerId,
      audience: memberships.at(-1)!.audience,
    });
    let currentView: Promise<unknown> | undefined;
    const view = () => (currentView ??= viewFor(plugin, current.state, audience));
    const withChecksum = async (patches: Patch[]) =>
      checksums ? { sequence, patches, checksum: checksumOf(await view()) } : { sequence, patches };
    if (since === sequence) return withChecksum([]);

    const base = await stateAt(em, gameId, since);
    if (!base) return { seeState: true };
    const then = memberships.filter(membership => membership.sequence <= since).at(-1)!;
    const baseAudience = effectiveAudience(plugin, { id: playerId, audience: then.audience });
    const baseView = await viewFor(plugin, base.state, baseAudience);
    return withChecksum(diff(baseView, await view()));
  });
