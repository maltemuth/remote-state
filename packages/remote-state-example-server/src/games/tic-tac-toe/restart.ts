/**
 * Tic-tac-toe across a server restart: a game whose turn timer was running is
 * paused, since the restart lost the timer, until the host resumes it once both
 * players are back. Resuming starts the turn over with its full time.
 */

import { freeMark } from "./rules.js";
import type { TicTacToeState } from "./types.js";

/** Whether the turn timer runs in this state */
export const hasTurnTimer = (state: TicTacToeState): boolean =>
  state.turnSeconds !== null && !state.outcome && !freeMark(state);

export const pauseOnRestart = (state: TicTacToeState): TicTacToeState =>
  hasTurnTimer(state) && !state.paused ? { ...state, paused: true } : state;
