/**
 * Tic-tac-toe's rules: setting up a game, seating players, and which actions are
 * allowed and what they do. Pure functions of the state.
 */

import { SYSTEM } from "@malte.muth/remote-state";
import { emptyBoard, isOnBoard, outcomeOf, placeMark } from "./board.js";
import type { Mark, TicTacToeAction, TicTacToeState } from "./types.js";

export const marks: Mark[] = ["X", "O"];

/** A game with no players yet; X moves first. Without `turnSeconds`, moves take as long as they take. */
export const newTicTacToeGame = ({
  turnSeconds = null,
}: { turnSeconds?: number | null } = {}): TicTacToeState => ({
  board: emptyBoard(),
  seats: {},
  starter: "X",
  turn: "X",
  outcome: null,
  turnSeconds,
});

/** How many marks are on the board, which identifies the current turn */
export const movesMade = (state: TicTacToeState): number =>
  state.board.flat().filter(Boolean).length;

const other = (mark: Mark): Mark => (mark === "X" ? "O" : "X");

export const markOf = (state: TicTacToeState, playerId: string): Mark | null =>
  marks.find((mark) => state.seats[mark]?.playerId === playerId) ?? null;

/** The first free mark, or null when both are taken */
export const freeMark = (state: TicTacToeState): Mark | null =>
  marks.find((mark) => !state.seats[mark]) ?? null;

/** `true`, or why the action isn't allowed */
export const checkAction = (
  state: TicTacToeState,
  action: TicTacToeAction,
  playerId: string,
): true | string => {
  if (action?.type === "timeout") {
    if (playerId !== SYSTEM) return "Only the system can end a turn";
    if (state.outcome || action.moves !== movesMade(state))
      return "That turn is over";
    return true;
  }
  const mark = markOf(state, playerId);
  if (!mark) return "Only seated players can play";
  if (freeMark(state)) return "Waiting for an opponent";

  switch (action?.type) {
    case "place":
      if (state.outcome) return "The game is over";
      if (state.turn !== mark) return "It's not your turn";
      if (!isOnBoard(action.row, action.col)) return "That's not a cell";
      if (state.board[action.row][action.col]) return "That cell is taken";
      return true;
    case "rematch":
      return state.outcome ? true : "The game isn't over yet";
    default:
      return "Unknown action";
  }
};

/** The state after an action that `checkAction` accepted */
export const applyAction = (
  state: TicTacToeState,
  action: TicTacToeAction,
): TicTacToeState => {
  if (action.type === "timeout") {
    return { ...state, outcome: { winner: other(state.turn), timeout: true } };
  }
  if (action.type === "rematch") {
    const starter = other(state.starter);
    return {
      ...state,
      board: emptyBoard(),
      outcome: null,
      starter,
      turn: starter,
    };
  }
  const board = placeMark(state.board, action.row, action.col, state.turn);
  const outcome = outcomeOf(board);
  return {
    ...state,
    board,
    outcome,
    turn: outcome ? state.turn : other(state.turn),
  };
};
