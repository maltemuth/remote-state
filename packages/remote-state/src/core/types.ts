import { RemoteStateServerConfiguration } from './server';

export interface SocketIOServerConfiguration {
  enabled?: boolean;
  cors?: {
    origin: string | string[];
    methods: string[];
  };
}

export interface GameValidationResult {
  valid: boolean;
  message: string;
  error?: string;
  code?: string;
}

export interface GameMoveResult<StateType> {
  success: boolean;
  state: StateType;
  gameOver: boolean;
  winner: string | null;
}

export interface GamePlugin<StateType, ActionType> {
  getInitialState: () => StateType;
  validateAction: (state: StateType, action: ActionType, playerId: string) => GameValidationResult;
  executeAction: (
    state: StateType,
    action: ActionType,
    playerId: string
  ) => GameMoveResult<StateType>;
  filterStateForPlayer?: (state: StateType, playerId: string) => StateType;
  gameConfig?: {
    name: string;
    description?: string;
  };
  serverConfiguration?: RemoteStateServerConfiguration;
}
