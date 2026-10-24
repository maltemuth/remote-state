/**
 * Offers every stored space to the rules' `onRestart` when the library starts on
 * a database that already has spaces (0052). Pending timers didn't survive the
 * restart (0042), so this is where a space pauses itself, or schedules again what
 * it needs. Rules that return the state they were given, with no changes,
 * record nothing.
 */

import { Space } from '../database/entities/index.js';
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

const restartSpace = (context: EngineContext, spaceId: string) =>
  context.withSpaceLock(spaceId, async () => {
    const previous = await latestState(context.orm.em.fork(), spaceId);
    if (!previous) return;
    const result = await context.plugin.onRestart!(previous.state);
    if (unchanged(previous.state, result)) return;
    await recordTransition(context, {
      spaceId,
      previous,
      result,
      authorId: SYSTEM,
      actionType: 'restart',
      actionData: null,
    });
  });

/** One space's failure is logged, and leaves that space as it was */
export const restartSpaces = async (context: EngineContext) => {
  if (!context.plugin.onRestart) return;
  const spaces = await context.orm.em.fork().find(Space, {}, { fields: ['id'] });
  for (const { id } of spaces) {
    await restartSpace(context, id).catch(err =>
      context.logger.error(`Restarting space ${id} failed; it's left as it was`, err)
    );
  }
};
