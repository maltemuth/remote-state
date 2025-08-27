export interface BaseAction {
  type: string;
  playerId: string;
  timestamp: Date;
}

export interface BaseState {
  createdAt: Date;
  updatedAt: Date;
}

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
  validationResult: GameValidationResult;
  gameOver: boolean;
  winner: string | null;
}

export interface GamePlugin<StateType, ActionType> {
  getInitialState: (gameId: string) => StateType;
  validateAction: (state: StateType, action: ActionType) => GameValidationResult;
  executeAction: (
    state: StateType,
    action: ActionType & { playerId: string; timestamp: Date }
  ) => GameMoveResult<StateType>;
  gameConfig?: {
    name: string;
    description?: string;
  };
  /** Database persistence configuration */
  persistDatabase?: boolean;
  databaseFilename?: string;
}
