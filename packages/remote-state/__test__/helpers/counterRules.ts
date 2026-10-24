/**
 * A small space for the library's tests: members increment a shared counter and see
 * their own increments; spectators see only the counter. It exercises the join
 * hook, refusals, audiences and audience changes.
 */

import { setTimeout as delay } from 'timers/promises';
import { Refusal, withAudiences, type Rules } from '../../src/index.js';

export const MAX_PLAYERS = 3;

export interface CounterState {
  count: number;
  /** Member ID → increments, for seated members */
  increments: Record<string, number>;
}

export type CounterAction = { type: 'increment' | 'spectate' | 'forbidden' | 'refuse' };

/** Seated members see their own increments; spectators see `mine: null` */
export interface CounterView {
  count: number;
  mine: number | null;
}

export const initialCounterState = (): CounterState => ({ count: 0, increments: {} });

export const counterRules = (
  overrides: Partial<Rules<CounterState, CounterAction, CounterView>> = {}
): Rules<CounterState, CounterAction, CounterView> => ({
  onJoin: (state, { memberId, details }) => {
    if (details.spectator) return withAudiences(state, { [memberId]: 'spectators' });
    if (Object.keys(state.increments).length >= MAX_PLAYERS) {
      throw new Refusal('Space is full');
    }
    return { ...state, increments: { ...state.increments, [memberId]: 0 } };
  },
  validateAction: (state, action, memberId) => {
    if (action.type === 'forbidden') return `Action ${action.type} is not allowed`;
    if (action.type === 'increment' && !(memberId in state.increments)) return 'Not seated';
    return true;
  },
  executeAction: async (state, action, memberId) => {
    if (action.type === 'refuse') throw new Refusal('Refused by the rules');
    if (action.type === 'spectate') {
      const { [memberId]: _, ...increments } = state.increments;
      return withAudiences({ ...state, increments }, { [memberId]: 'spectators' });
    }
    // Yield, so that unserialized concurrent actions would interleave
    await delay(5);
    const increments = { ...state.increments, [memberId]: state.increments[memberId] + 1 };
    return { ...state, count: state.count + 1, increments };
  },
  view: (state, audience) => ({
    count: state.count,
    mine: audience === 'spectators' ? null : (state.increments[audience] ?? null),
  }),
  ...overrides,
});
