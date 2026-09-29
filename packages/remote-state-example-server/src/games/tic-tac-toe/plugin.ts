import type { GamePlugin } from "@malte.muth/remote-state";
import {
  TicTacToeAction,
  TicTacToeState,
  createInitialGameState,
} from "./types.js";
import {
  executeAction,
  filterStateForPlayer,
  validateAction,
} from "./engine.js";

/**
 * Adapts the tic-tac-toe engine to the Remote State plugin interface
 */
export const ticTacToePlugin: GamePlugin<
  TicTacToeState,
  TicTacToeAction,
  TicTacToeState
> = {
  getInitialState: async () => createInitialGameState(),
  validateAction: async (state, action, playerId) => {
    const result = await validateAction(state, action, playerId);
    return result.valid ? true : result.message;
  },
  executeAction: async (state, action, playerId) =>
    (await executeAction(state, action, playerId)).state,
  filterStateForPlayer: async (state, playerId) =>
    filterStateForPlayer(state, playerId),
  gameConfig: {
    name: "Tic-Tac-Toe",
    description: "Classic 3x3 tic-tac-toe game",
  },
};
