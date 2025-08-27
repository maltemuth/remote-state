import { GameValidationResult } from '../core/types';

export const validateGameAction = <StateType, ActionType>(
  state: StateType,
  action: ActionType,
  gameRules: {
    validateAction: (state: StateType, action: ActionType) => GameValidationResult;
  }
): GameValidationResult => {
  return gameRules.validateAction(state, action);
};
