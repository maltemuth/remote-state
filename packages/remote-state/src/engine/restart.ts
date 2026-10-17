/**
 * Offers every stored game to the plugin's `onRestart` when the library starts on
 * a database that already has games (0052). Pending timers didn't survive the
 * restart (0042), so this is where a game pauses itself, or schedules again what
 * it needs. A game that returns the state it was given, with no changes, records
 * nothing.
 */

import { Game } from '../database/entities/index.js';
import { SYSTEM } from '../plugin/system.js';
import { unwrapTransition } from '../plugin/transition.js';
import { type EngineContext } from './context.js';
import { recordTransition } from './recordTransition.js';
import { latestState } from './states.js';

const unchanged = (previousState: unknown, result: unknown) => {
  const { state, changes } = unwrapTransition(result);
  return (
    state === previousState &&
    Object.keys(changes.audiences).length === 0 &&
    changes.schedule.length === 0 &&
    changes.cancel.length === 0
  );
};

const restartGame = (context: EngineContext, gameId: string) =>
  context.withGameLock(gameId, async () => {
    const previous = await latestState(context.orm.em.fork(), gameId);
    if (!previous) return;
    const result = await context.plugin.onRestart!(previous.state);
    if (unchanged(previous.state, result)) return;
    await recordTransition(context, {
      gameId,
      previous,
      result,
      authorId: SYSTEM,
      actionType: 'restart',
      actionData: null,
    });
  });

/** One game's failure is logged, and leaves that game as it was */
export const restartGames = async (context: EngineContext) => {
  if (!context.plugin.onRestart) return;
  const games = await context.orm.em.fork().find(Game, {}, { fields: ['id'] });
  for (const { id } of games) {
    await restartGame(context, id).catch(err =>
      context.logger.error(`Restarting game ${id} failed; it's left as it was`, err)
    );
  }
};
