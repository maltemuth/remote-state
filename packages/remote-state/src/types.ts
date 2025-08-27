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
