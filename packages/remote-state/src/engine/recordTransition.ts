/**
 * Records one state transition, from a join or an action, in a single database
 * transaction: the new full state with its full-state diff (0013), each audience's
 * diff (0024), and audience changes (0027). Callers hold the game's lock.
 */

import { AudienceDiff, AudienceMembership, GameState, Player } from '../database/entities/index.js';
import { diff } from '../patches/diff.js';
import { type StateResult } from '../plugin/types.js';
import { SYSTEM } from '../plugin/system.js';
import { unwrapTransition } from '../plugin/transition.js';
import { toJson } from '../json.js';
import {
  applyAudienceChanges,
  computeAudienceUpdates,
  effectiveAudiences,
} from './audienceUpdates.js';
import { checkTimerRequests } from './scheduler.js';
import { type EngineContext, type TransitionOutcome } from './context.js';
import { type StoredState } from './states.js';

export interface TransitionInput {
  gameId: string;
  previous: StoredState;
  /** What the game's join hook or `executeAction` returned */
  result: StateResult<unknown>;
  /** A player ID, or `SYSTEM` */
  authorId: string;
  actionType: string;
  actionData: unknown;
  /** Set when the transition adds this player to the game */
  joiningPlayer?: { id: string; identityId: string };
}

export const recordTransition = async (
  context: EngineContext,
  input: TransitionInput
): Promise<TransitionOutcome> => {
  const { outcome, author } = await persist(context, input);
  context.logger.info(
    `${input.actionType} by ${author} in game ${input.gameId}, now at ${outcome.sequence}`
  );
  return outcome;
};

const persist = (
  { orm, plugin }: EngineContext,
  input: TransitionInput
): Promise<{ outcome: TransitionOutcome; author: string }> =>
  orm.em.fork().transactional(async em => {
    const { gameId, previous, joiningPlayer } = input;
    const { state: returned, changes } = unwrapTransition(input.result);
    checkTimerRequests(changes.schedule);
    const state = toJson(returned);
    const playerId = input.authorId === SYSTEM ? null : input.authorId;
    const sequence = previous.sequence + 1;

    const players = await em.find(Player, { game: gameId });
    const storedBefore = new Map(players.map(player => [player.id, player.audience]));
    const withJoining = new Map(storedBefore);
    if (joiningPlayer) withJoining.set(joiningPlayer.id, null);
    const storedAfter = applyAudienceChanges(withJoining, changes.audiences);

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

    // The author's audience as they acted; a joining player's, as they joined (0039)
    const authorAudience =
      playerId === null
        ? null
        : ((joiningPlayer ? audiencesAfter : audiencesBefore).get(playerId) ?? null);
    em.create(GameState, {
      game: gameId,
      sequence,
      state,
      fullDiff: diff(previous.state, state),
      player: playerId,
      audience: authorAudience,
      actionType: input.actionType,
      actionData: input.actionData ?? null,
    });
    for (const [audience, { patches }] of updates) {
      em.create(AudienceDiff, { game: gameId, audience, sequence, patches });
    }

    const author = playerId === null ? SYSTEM : `${authorAudience}:${playerId}`;
    const outcome: TransitionOutcome = {
      gameId,
      sequence,
      previousState: previous.state,
      updates,
      audiencesBefore,
      audiencesAfter,
      timers: { schedule: changes.schedule, cancel: changes.cancel },
    };
    return { outcome, author };
  });
