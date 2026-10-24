/**
 * Finds the member for a host identity in a space, or adds one through the space's
 * join hook (decision 0026), under the space's lock.
 */

import { randomUUID } from 'crypto';
import { Member } from '../database/entities/index.js';
import { Refusal } from '../plugin/refusal.js';
import { UnknownSpaceError } from '../server/errors.js';
import { type EngineContext } from './context.js';
import { recordTransition } from './recordTransition.js';
import { latestState } from './states.js';

export type JoinResult = { memberId: string } | { refused: string };

export const joinSpace = (
  context: EngineContext,
  spaceId: string,
  identityId: string,
  details: Record<string, unknown>
): Promise<JoinResult> =>
  context.withSpaceLock(spaceId, async () => {
    const em = context.orm.em.fork();
    const existing = await em.findOne(Member, { space: spaceId, identityId });
    if (existing) return { memberId: existing.id };

    const previous = await latestState(em, spaceId);
    if (!previous) throw new UnknownSpaceError(spaceId);

    const memberId = randomUUID();
    let result: unknown = previous.state;
    try {
      if (context.plugin.onJoin) {
        result = await context.plugin.onJoin(previous.state, { memberId, details });
      }
    } catch (err) {
      if (err instanceof Refusal) return { refused: err.message };
      throw err;
    }

    await recordTransition(context, {
      spaceId,
      previous,
      result,
      authorId: memberId,
      actionType: 'join',
      actionData: null,
      joiningMember: { id: memberId, identityId },
    });
    return { memberId };
  });
