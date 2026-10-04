/**
 * Records one state transition, from a join or an action, in a single database
 * transaction: the new full state with its full-state diff (0013), each audience's
 * diff (0024), and audience changes (0027). Callers hold the game's lock.
 */

import { AudienceDiff, AudienceMembership, GameState, Player } from '../database/entities/index.js';
import { diff } from '../patches/diff.js';
import { type StateResult } from '../plugin/types.js';
import { unwrapTransition } from '../plugin/transition.js';
import { toJson } from '../json.js';
import {
  applyAudienceChanges,
  computeAudienceUpdates,
  effectiveAudiences,
} from './audienceUpdates.js';
import { type EngineContext, type TransitionOutcome } from './context.js';
import { type StoredState } from './states.js';

export interface TransitionInput {
  gameId: string;
  previous: StoredState;
  /** What the game's join hook or `executeAction` returned */
  result: StateResult<unknown>;
  authorId: string;
  actionType: string;
  actionData: unknown;
  /** Set when the transition adds this player to the game */
  joiningPlayer?: { id: string; identityId: string };
}

export const recordTransition = (
  { orm, plugin }: EngineContext,
  input: TransitionInput
): Promise<TransitionOutcome> =>
  orm.em.fork().transactional(async em => {
    const { gameId, previous, joiningPlayer } = input;
    const { state: returned, audiences: changes } = unwrapTransition(input.result);
    const state = toJson(returned);
    const sequence = previous.sequence + 1;

    const players = await em.find(Player, { game: gameId });
    const storedBefore = new Map(players.map(player => [player.id, player.audience]));
    const withJoining = new Map(storedBefore);
    if (joiningPlayer) withJoining.set(joiningPlayer.id, null);
    const storedAfter = applyAudienceChanges(withJoining, changes);

    const audiencesBefore = effectiveAudiences(plugin, storedBefore);
    const audiencesAfter = effectiveAudiences(plugin, storedAfter);
    const updates = await computeAudienceUpdates(
      plugin,
      previous.state,
      state,
      audiencesAfter.values()
    );

    if (joiningPlayer) {
      const audience = storedAfter.get(joiningPlayer.id) ?? null;
      em.create(Player, { ...joiningPlayer, game: gameId, audience, lastActivityAt: new Date() });
      em.create(AudienceMembership, { player: joiningPlayer.id, sequence, audience });
    }
    for (const player of players) {
      const audience = storedAfter.get(player.id) ?? null;
      if (audience !== player.audience) {
        player.audience = audience;
        em.create(AudienceMembership, { player, sequence, audience });
      }
      if (player.id === input.authorId) player.lastActivityAt = new Date();
    }

    em.create(GameState, {
      game: gameId,
      sequence,
      state,
      fullDiff: diff(previous.state, state),
      player: input.authorId,
      actionType: input.actionType,
      actionData: input.actionData ?? null,
    });
    for (const [audience, { patches }] of updates) {
      em.create(AudienceDiff, { game: gameId, audience, sequence, patches });
    }

    return {
      gameId,
      sequence,
      previousState: previous.state,
      updates,
      audiencesBefore,
      audiencesAfter,
    };
  });
