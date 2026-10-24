/**
 * Battleship as a Remote State plugin. Seats are taken when a player is admitted,
 * and each player sees only their own ships (one audience per player, the
 * default).
 */

import { Refusal, type Rules } from "@malte.muth/remote-state";
import {
  executeAction,
  filterStateForPlayer,
  validateAction,
} from "./engine.js";
import { type BattleshipAction, type BattleshipState } from "./types.js";

export { newBattleshipGame } from "./types.js";

export const battleshipRules: Rules<BattleshipState, BattleshipAction> = {
  onJoin: (state, { memberId: playerId }) => {
    const seat = !state.players.player1
      ? "player1"
      : !state.players.player2
        ? "player2"
        : null;
    if (!seat) throw new Refusal("Both seats are taken");
    return { ...state, players: { ...state.players, [seat]: playerId } };
  },
  validateAction,
  executeAction,
  // The default audience of each player is named by their player ID
  view: filterStateForPlayer,
};
