import type { GamePlugin } from "@malte.muth/remote-state";
import {
  BattleshipAction,
  BattleshipState,
  createInitialGameState,
} from "./types.js";
import {
  executeAction,
  filterStateForPlayer,
  validateAction,
} from "./engine.js";

/**
 * Adapts the battleship engine to the Remote State plugin interface
 */
export const battleshipPlugin: GamePlugin<
  BattleshipState,
  BattleshipAction,
  BattleshipState
> = {
  getInitialState: async () => createInitialGameState(""),
  validateAction: async (state, action, playerId) => {
    const result = await validateAction(state, action, playerId);
    return result.valid ? true : result.message;
  },
  executeAction: async (state, action, playerId) =>
    (await executeAction(state, action, playerId)).state,
  filterStateForPlayer: async (state, playerId) =>
    filterStateForPlayer(state, playerId),
  gameConfig: {
    name: "Battleship",
    description: "5x5 battleship with a destroyer (3) and a battleship (4)",
  },
};
