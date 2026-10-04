/**
 * Pure board logic for tic-tac-toe: empty boards, placing marks, and finding the
 * outcome. Nothing here knows about players or the library.
 */

import type { Board, Mark, Outcome, Position } from "./types.js";

export const SIZE = 3;

const range = [...Array(SIZE).keys()];

/** Rows, columns and both diagonals */
const lines: Position[][] = [
  ...range.map((row) => range.map((col): Position => [row, col])),
  ...range.map((col) => range.map((row): Position => [row, col])),
  range.map((i): Position => [i, i]),
  range.map((i): Position => [i, SIZE - 1 - i]),
];

export const emptyBoard = (): Board => range.map(() => range.map(() => null));

export const isOnBoard = (row: unknown, col: unknown): boolean =>
  [row, col].every(
    (value) =>
      Number.isInteger(value) && Number(value) >= 0 && Number(value) < SIZE,
  );

/** A new board with `mark` at `row`, `col` */
export const placeMark = (
  board: Board,
  row: number,
  col: number,
  mark: Mark,
): Board =>
  board.map((cells, r) =>
    cells.map((cell, c) => (r === row && c === col ? mark : cell)),
  );

export const outcomeOf = (board: Board): Outcome => {
  for (const line of lines) {
    const [first, ...rest] = line.map(([row, col]) => board[row][col]);
    if (first && rest.every((cell) => cell === first)) {
      return { winner: first, line };
    }
  }
  return board.every((cells) => cells.every(Boolean))
    ? { winner: null, draw: true }
    : null;
};
