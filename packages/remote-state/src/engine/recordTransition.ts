/**
 * Records one state transition, from a join or an action, in a single database
 * transaction: the new full state and audience changes (0027). Views and patches
 * aren't stored; they're computed when the transition is published (0056). Once
 * it's recorded, applies its timers and publishes it. Callers hold the space's lock.
 */

import { AudienceMembership, SpaceState, Member } from '../database/entities/index.js';
import { type StateResult } from '../plugin/types.js';
import { SYSTEM } from '../plugin/system.js';
import { unwrapTransition } from '../plugin/transition.js';
import { droppedKeysWarning, toJson } from '../json.js';
import { applyAudienceChanges, effectiveAudiences } from './audienceUpdates.js';
import { checkTimerRequests } from './scheduler.js';
import { type EngineContext, type TransitionOutcome } from './context.js';
import { type StoredState } from './states.js';

export interface TransitionInput {
  spaceId: string;
  previous: StoredState;
  /** What the space's join hook or `executeAction` returned */
  result: StateResult<unknown>;
  /** A member ID, or `SYSTEM` */
  authorId: string;
  actionType: string;
  actionData: unknown;
  /** Set when the transition adds this member to the space */
  joiningMember?: { id: string; identityId: string };
}

export const recordTransition = async (
  context: EngineContext,
  input: TransitionInput
): Promise<TransitionOutcome> => {
  const { outcome, author } = await persist(context, input);
  context.logger.info(
    `${input.actionType} by ${author} in space ${input.spaceId}, now at ${outcome.sequence}`
  );
  context.scheduler.apply(input.spaceId, outcome.timers.schedule, outcome.timers.cancel);
  await context.publisher.publish(outcome);
  return outcome;
};

const persist = (
  { orm, plugin, logger }: EngineContext,
  input: TransitionInput
): Promise<{ outcome: TransitionOutcome; author: string }> =>
  orm.em.fork().transactional(async em => {
    const { spaceId, previous, joiningMember } = input;
    const { state: returned, changes } = unwrapTransition(input.result);
    checkTimerRequests(changes.schedule, changes.cancel);
    const sequence = previous.sequence + 1;
    const state = toJson(returned, keys =>
      logger.warn(droppedKeysWarning(keys, spaceId, sequence))
    );
    const memberId = input.authorId === SYSTEM ? null : input.authorId;

    const members = await em.find(Member, { space: spaceId });
    const storedBefore = new Map(members.map(member => [member.id, member.audience]));
    const withJoining = new Map(storedBefore);
    if (joiningMember) withJoining.set(joiningMember.id, null);
    const storedAfter = applyAudienceChanges(withJoining, changes.audiences);

    const audiencesBefore = effectiveAudiences(plugin, storedBefore);
    const audiencesAfter = effectiveAudiences(plugin, storedAfter);

    if (joiningMember) {
      const audience = storedAfter.get(joiningMember.id) ?? null;
      em.create(Member, { ...joiningMember, space: spaceId, audience });
      em.create(AudienceMembership, { member: joiningMember.id, sequence, audience });
    }
    for (const member of members) {
      const audience = storedAfter.get(member.id) ?? null;
      if (audience !== member.audience) {
        member.audience = audience;
        em.create(AudienceMembership, { member, sequence, audience });
      }
    }

    // The author's audience as they acted; a joining member's, as they joined (0039)
    const authorAudience =
      memberId === null
        ? null
        : ((joiningMember ? audiencesAfter : audiencesBefore).get(memberId) ?? null);
    em.create(SpaceState, {
      space: spaceId,
      sequence,
      state,
      member: memberId,
      audience: authorAudience,
      actionType: input.actionType,
      actionData: input.actionData ?? null,
    });

    const author = memberId === null ? SYSTEM : `${authorAudience}:${memberId}`;
    const outcome: TransitionOutcome = {
      spaceId,
      sequence,
      previousState: previous.state,
      state,
      audiencesBefore,
      audiencesAfter,
      timers: { schedule: changes.schedule, cancel: changes.cancel },
    };
    return { outcome, author };
  });
