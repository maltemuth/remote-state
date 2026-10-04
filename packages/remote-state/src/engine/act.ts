/**
 * Runs a player's action through the game's rules, records the new state and
 * publishes it, all under the game's lock.
 */

import { GameRefusal } from '../plugin/refusal.js';
import { type EngineContext } from './context.js';
import { recordTransition } from './recordTransition.js';
import { latestState } from './states.js';

export type ActResult = { sequence: number } | { rejected: string };

const actionType = (action: unknown): string => {
  const type = (action as { type?: unknown } | null)?.type;
  return typeof type === 'string' ? type : 'unknown';
};

export const act = (
  context: EngineContext,
  gameId: string,
  playerId: string,
  action: unknown
): Promise<ActResult> =>
  context.withGameLock(gameId, async () => {
    const { plugin } = context;
    const previous = await latestState(context.orm.em.fork(), gameId);
    if (!previous) throw new Error(`Game ${gameId} has no state`);

    const validation = await plugin.validateAction(previous.state, action, playerId);
    if (validation !== true) return { rejected: validation };

    let result: unknown;
    try {
      result = await plugin.executeAction(previous.state, action, playerId);
    } catch (err) {
      if (err instanceof GameRefusal) return { rejected: err.message };
      throw err;
    }

    const outcome = await recordTransition(context, {
      gameId,
      previous,
      result,
      authorId: playerId,
      actionType: actionType(action),
      actionData: action,
    });
    await context.publisher.publish(outcome);
    return { sequence: outcome.sequence };
  });
