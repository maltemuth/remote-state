/**
 * Runs a due timer's action as the system (decisions 0040, 0041), under the game's
 * lock, unless a transition replaced or cancelled the timer in the meantime.
 */

import { SYSTEM } from '../plugin/system.js';
import { runAction } from './act.js';
import { type EngineContext } from './context.js';
import { type PendingTimer } from './scheduler.js';

export const runDueTimer = (context: EngineContext, timer: PendingTimer) =>
  context
    .withGameLock(timer.gameId, async () => {
      if (!context.scheduler.claim(timer)) return;
      const result = await runAction(context, timer.gameId, SYSTEM, timer.action);
      if ('rejected' in result) {
        context.logger.info(
          `Timer ${timer.name} in game ${timer.gameId} was rejected: ${result.rejected}`
        );
      }
    })
    .catch(err => context.logger.error(`Timer ${timer.name} in game ${timer.gameId} failed`, err));
