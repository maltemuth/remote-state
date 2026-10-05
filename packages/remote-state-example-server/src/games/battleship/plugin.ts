/**
 * Battleship as a Remote State plugin. Seats are taken when a player is admitted,
 * and each player sees only their own ships (one audience per player, the
 * default).
 */

import { GameRefusal, type GamePlugin } from "@malte.muth/remote-state";
import {
  executeAction,
  filterStateForPlayer,
  validateAction,
} from "./engine.js";
import { type BattleshipAction, type BattleshipState } from "./types.js";

export { newBattleshipGame } from "./types.js";

export const battleshipPlugin: GamePlugin<BattleshipState, BattleshipAction> = {
  onJoin: (state, { playerId }) => {
    const seat = !state.players.player1
      ? "player1"
      : !state.players.player2
        ? "player2"
        : null;
    if (!seat) throw new GameRefusal("Both seats are taken");
    return { ...state, players: { ...state.players, [seat]: playerId } };
  },
  validateAction,
  executeAction,
  // The default audience of each player is named by their player ID
  filterStateForAudience: filterStateForPlayer,
  gameConfig: {
    name: "Battleship",
    description: "Battleship by the classic rules: 10×10, five ships each",
  },
};
