/**
 * Tic-tac-toe as a Remote State game: the first two people admitted get X and O,
 * everyone after that is refused. No view filter, since nothing is hidden. With a
 * time limit, a turn timer runs while the game does.
 */

import { GameRefusal, type GamePlugin } from "@malte.muth/remote-state";
import { applyAction, checkAction, freeMark } from "./rules.js";
import { withTurnTimer } from "./turnTimer.js";
import type { TicTacToeAction, TicTacToeState } from "./types.js";

export const ticTacToePlugin: GamePlugin<TicTacToeState, TicTacToeAction> = {
  onJoin: (state, { playerId, details }) => {
    const mark = freeMark(state);
    if (!mark) throw new GameRefusal("Both seats are taken");
    const name =
      typeof details.name === "string" && details.name
        ? details.name
        : `Player ${mark}`;
    return withTurnTimer({
      ...state,
      seats: { ...state.seats, [mark]: { playerId, name } },
    });
  },
  validateAction: (state, action, playerId) =>
    checkAction(state, action, playerId),
  executeAction: (state, action) => withTurnTimer(applyAction(state, action)),
  gameConfig: {
    name: "Tic-Tac-Toe",
    description: "Two players take turns placing X and O on a 3×3 board",
  },
};
