/**
 * A small game for the library's tests: players increment a shared counter and see
 * their own increments; spectators see only the counter. It exercises the join
 * hook, refusals, audiences and audience changes.
 */

import { setTimeout as delay } from 'timers/promises';
import { GameRefusal, withAudiences, type GamePlugin } from '../../src/index.js';

export const MAX_PLAYERS = 3;

export interface CounterState {
  count: number;
  /** Player ID → increments, for seated players */
  increments: Record<string, number>;
}

export type CounterAction = { type: 'increment' | 'spectate' | 'forbidden' | 'refuse' };

/** Seated players see their own increments; spectators see `mine: null` */
export interface CounterView {
  count: number;
  mine: number | null;
}

export const initialCounterState = (): CounterState => ({ count: 0, increments: {} });

export const counterGame = (
  overrides: Partial<GamePlugin<CounterState, CounterAction, CounterView>> = {}
): GamePlugin<CounterState, CounterAction, CounterView> => ({
  onJoin: (state, { playerId, details }) => {
    if (details.spectator) return withAudiences(state, { [playerId]: 'spectators' });
    if (Object.keys(state.increments).length >= MAX_PLAYERS) {
      throw new GameRefusal('Game is full');
    }
    return { ...state, increments: { ...state.increments, [playerId]: 0 } };
  },
  validateAction: (state, action, playerId) => {
    if (action.type === 'forbidden') return `Action ${action.type} is not allowed`;
    if (action.type === 'increment' && !(playerId in state.increments)) return 'Not seated';
    return true;
  },
  executeAction: async (state, action, playerId) => {
    if (action.type === 'refuse') throw new GameRefusal('Refused by the rules');
    if (action.type === 'spectate') {
      const { [playerId]: _, ...increments } = state.increments;
      return withAudiences({ ...state, increments }, { [playerId]: 'spectators' });
    }
    // Yield, so that unserialized concurrent actions would interleave
    await delay(5);
    const increments = { ...state.increments, [playerId]: state.increments[playerId] + 1 };
    return { ...state, count: state.count + 1, increments };
  },
  filterStateForAudience: (state, audience) => ({
    count: state.count,
    mine: audience === 'spectators' ? null : (state.increments[audience] ?? null),
  }),
  gameConfig: { name: 'Counter' },
  ...overrides,
});
