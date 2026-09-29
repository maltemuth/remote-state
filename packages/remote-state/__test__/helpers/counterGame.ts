import { GamePlugin, RemoteStateServerConfiguration } from '../../src/core/types';
import { setTimeout as delay } from 'timers/promises';
import { LogLevel } from '../../src';

/** Full state: a shared counter plus which player made each increment */
export interface CounterState {
  count: number;
  incrementedBy: string[];
}

export interface CounterAction {
  type: 'increment' | 'forbidden';
}

/** What a player sees: the counter and their own increments, not who else played */
export interface CounterPlayerState {
  count: number;
  mine: number;
}

export const counterGame = (
  overrides: Partial<GamePlugin<CounterState, CounterAction, CounterPlayerState>> = {},
  serverConfiguration: RemoteStateServerConfiguration = {}
): GamePlugin<CounterState, CounterAction, CounterPlayerState> => ({
  getInitialState: async () => ({ count: 0, incrementedBy: [] }),
  validateAction: async (_state, action) =>
    action.type === 'increment' ? true : `Action ${action.type} is not allowed`,
  executeAction: async (state, _action, playerId) => {
    // Yield so that unserialized concurrent actions would interleave
    await delay(5);
    return { count: state.count + 1, incrementedBy: [...state.incrementedBy, playerId] };
  },
  filterStateForPlayer: async (state, playerId) => ({
    count: state.count,
    mine: state.incrementedBy.filter(id => id === playerId).length,
  }),
  gameConfig: { name: 'Counter' },
  serverConfiguration: { minimumLogLevel: LogLevel.error, ...serverConfiguration },
  ...overrides,
});
