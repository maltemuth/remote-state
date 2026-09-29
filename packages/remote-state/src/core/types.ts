import { LogLevel } from '../utils/logger';

export interface RemoteStateServerConfiguration {
  minimumLogLevel?: LogLevel;
  /** Persist to `databaseFilename` (default `games.db`) instead of an in-memory database */
  persistDatabase?: boolean;
  databaseFilename?: string;
  /** Socket.IO server configuration */
  socketIO?: SocketIOServerConfiguration;
}

export interface SocketIOServerConfiguration {
  enabled?: boolean;
  cors?: {
    origin: string | string[];
    methods: string[];
  };
}

export type ActionValidationResult = true | string;

export interface GamePlugin<StateType, ActionType, PlayerStateType> {
  getInitialState: () => Promise<StateType>;
  validateAction: (
    state: StateType,
    action: ActionType,
    playerId: string
  ) => Promise<ActionValidationResult>;
  executeAction: (state: StateType, action: ActionType, playerId: string) => Promise<StateType>;
  /**
   * Reduce the full state to what `playerId` may see. Every state sent to a client
   * passes through this. Without it, clients receive the full state.
   */
  filterStateForPlayer?: (state: StateType, playerId: string) => Promise<PlayerStateType>;
  gameConfig?: {
    name: string;
    description?: string;
  };
  serverConfiguration?: RemoteStateServerConfiguration;
}

/** Apply the plugin's filter, or pass the full state through if it has none */
export const stateForPlayer = <StateType, PlayerStateType>(
  plugin: GamePlugin<StateType, unknown, PlayerStateType>,
  state: StateType,
  playerId: string
): Promise<PlayerStateType> =>
  plugin.filterStateForPlayer
    ? plugin.filterStateForPlayer(state, playerId)
    : Promise.resolve(state as unknown as PlayerStateType);
