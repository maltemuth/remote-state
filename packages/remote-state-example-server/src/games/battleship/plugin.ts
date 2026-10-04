/**
 * Adapts the battleship engine to the Remote State plugin interface. Seats are
 * taken when a player is admitted (the engine's `join`), and each player sees
 * only their own ships (one audience per player, the default).
 */

import { GameRefusal, type GamePlugin } from "@malte.muth/remote-state";
import {
  executeAction,
  filterStateForPlayer,
  validateAction,
} from "./engine.js";
import {
  type BattleshipAction,
  type BattleshipState,
  createInitialGameState,
} from "./types.js";

/** Joining and leaving happen through admission, not as actions */
const lifecycleActions = ["join", "leave"];

/** A game with both seats free, for the host to pass to `createGame` */
export const newBattleshipGame = (): BattleshipState =>
  createInitialGameState("");

export const battleshipPlugin: GamePlugin<BattleshipState, BattleshipAction> = {
  onJoin: async (state, { playerId }) => {
    const join: BattleshipAction = { type: "join" };
    const check = await validateAction(state, join, playerId);
    if (!check.valid) throw new GameRefusal(check.message);
    return (await executeAction(state, join, playerId)).state;
  },
  validateAction: async (state, action, playerId) => {
    if (lifecycleActions.includes(action.type))
      return `${action.type} isn't an action`;
    const result = await validateAction(state, action, playerId);
    return result.valid ? true : result.message;
  },
  executeAction: async (state, action, playerId) =>
    (await executeAction(state, action, playerId)).state,
  // The default audience of each player is named by their player ID
  filterStateForAudience: (state, audience) =>
    filterStateForPlayer(state, audience),
  gameConfig: {
    name: "Battleship",
    description: "5x5 battleship with a destroyer (3) and a battleship (4)",
  },
};
