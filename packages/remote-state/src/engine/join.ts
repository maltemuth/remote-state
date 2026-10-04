/**
 * Finds the player for a host identity in a game, or adds one through the game's
 * join hook (decision 0026), under the game's lock.
 */

import { randomUUID } from 'crypto';
import { Player } from '../database/entities/index.js';
import { GameRefusal } from '../plugin/refusal.js';
import { type EngineContext } from './context.js';
import { recordTransition } from './recordTransition.js';
import { latestState } from './states.js';

export type JoinResult = { playerId: string } | { refused: string };

export const joinGame = (
  context: EngineContext,
  gameId: string,
  identityId: string,
  details: Record<string, unknown>
): Promise<JoinResult> =>
  context.withGameLock(gameId, async () => {
    const em = context.orm.em.fork();
    const existing = await em.findOne(Player, { game: gameId, identityId });
    if (existing) return { playerId: existing.id };

    const previous = await latestState(em, gameId);
    if (!previous) throw new Error(`Game ${gameId} has no state`);

    const playerId = randomUUID();
    let result: unknown = previous.state;
    try {
      if (context.plugin.onJoin) {
        result = await context.plugin.onJoin(previous.state, { playerId, details });
      }
    } catch (err) {
      if (err instanceof GameRefusal) return { refused: err.message };
      throw err;
    }

    const outcome = await recordTransition(context, {
      gameId,
      previous,
      result,
      authorId: playerId,
      actionType: 'join',
      actionData: null,
      joiningPlayer: { id: playerId, identityId },
    });
    context.scheduler.apply(gameId, outcome.timers.schedule, outcome.timers.cancel);
    await context.publisher.publish(outcome);
    return { playerId };
  });
