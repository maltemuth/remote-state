/**
 * Tic-tac-toe's turn timer: while a game with a time limit is running, every state
 * change restarts the `turn` timer, and the end of a game cancels it. When it runs
 * out, the system sends `timeout`, and the player to move loses.
 */

import { transition, type StateResult } from "@malte.muth/remote-state";
import { freeMark, movesMade } from "./rules.js";
import type { TicTacToeAction, TicTacToeState } from "./types.js";

export const withTurnTimer = (
  state: TicTacToeState,
): StateResult<TicTacToeState, TicTacToeAction> => {
  if (state.turnSeconds === null) return state;
  if (state.outcome || freeMark(state)) {
    return transition(state, { cancel: ["turn"] });
  }
  return transition(state, {
    schedule: [
      {
        name: "turn",
        in: state.turnSeconds * 1000,
        action: { type: "timeout", moves: movesMade(state) },
      },
    ],
  });
};
