/**
 * Runs an action through the rules, records the new state, applies its
 * timers and publishes it. `dispatch` takes the space's lock; `runAction` expects the
 * caller to hold it, as due timers do.
 */

import { Refusal } from '../plugin/refusal.js';
import { UnknownSpaceError } from '../server/errors.js';
import { type EngineContext } from './context.js';
import { recordTransition } from './recordTransition.js';
import { latestState } from './states.js';

export type DispatchResult = { sequence: number } | { rejected: string };

const actionType = (action: unknown): string => {
  const type = (action as { type?: unknown } | null)?.type;
  return typeof type === 'string' ? type : 'unknown';
};

/** Callers hold the space's lock */
export const runAction = async (
  context: EngineContext,
  spaceId: string,
  memberId: string,
  action: unknown
): Promise<DispatchResult> => {
  const { plugin } = context;
  const previous = await latestState(context.orm.em.fork(), spaceId);
  if (!previous) throw new UnknownSpaceError(spaceId);

  let result: unknown;
  try {
    const validation = await plugin.validateAction(previous.state, action, memberId);
    if (validation !== true) return { rejected: validation };
    result = await plugin.executeAction(previous.state, action, memberId);
  } catch (err) {
    if (err instanceof Refusal) return { rejected: err.message };
    throw err;
  }

  const outcome = await recordTransition(context, {
    spaceId,
    previous,
    result,
    authorId: memberId,
    actionType: actionType(action),
    actionData: action,
  });
  return { sequence: outcome.sequence };
};

export const dispatch = (
  context: EngineContext,
  spaceId: string,
  memberId: string,
  action: unknown
): Promise<DispatchResult> =>
  context.withSpaceLock(spaceId, () => runAction(context, spaceId, memberId, action));
