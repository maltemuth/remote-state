import { RemoteStateServerConfiguration } from './server';

export type GameAction =
  | {
      type: 'move';
      position: [number, number];
      playerId: string;
      timestamp: Date;
    }
  | { type: 'restart'; playerId: string; timestamp: Date }
  | { type: 'join'; playerId: string; timestamp: Date }
  | { type: 'leave'; playerId: string; timestamp: Date };

export interface SocketIOServerConfiguration {
  enabled?: boolean;
  cors?: {
    origin: string | string[];
    methods: string[];
  };
}

export const isMoveAction = (
  action: GameAction
): action is Extract<GameAction, { type: 'move' }> => {
  return action.type === 'move';
};

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
  validateAction: (state: StateType, action: ActionType) => GameValidationResult;
  executeAction: (
    state: StateType,
    action: ActionType & { playerId: string; timestamp: Date }
  ) => GameMoveResult<StateType>;
  gameConfig?: {
    name: string;
    description?: string;
  };
  serverConfiguration?: RemoteStateServerConfiguration;
}
