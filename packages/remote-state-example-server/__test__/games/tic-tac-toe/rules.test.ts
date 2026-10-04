/**
 * Tic-tac-toe's rules as plain functions: outcomes on every kind of line, and
 * action checks, without a server.
 */

import { describe, expect, it } from "@jest/globals";
import { SYSTEM, transition } from "@malte.muth/remote-state";
import {
  applyAction,
  checkAction,
  emptyBoard,
  newTicTacToeGame,
  outcomeOf,
  placeMark,
  type Board,
  type Position,
  withTurnTimer,
} from "../../../src/games/tic-tac-toe/index.js";

const boardWith = (cells: Position[]): Board =>
  cells.reduce(
    (board, [row, col]) => placeMark(board, row, col, "O"),
    emptyBoard(),
  );

const seated = () => ({
  ...newTicTacToeGame(),
  seats: { X: { playerId: "x", name: "X" }, O: { playerId: "o", name: "O" } },
});

describe("tic-tac-toe rules", () => {
  it.each<[string, Position[]]>([
    [
      "a row",
      [
        [2, 0],
        [2, 1],
        [2, 2],
      ],
    ],
    [
      "a column",
      [
        [0, 1],
        [1, 1],
        [2, 1],
      ],
    ],
    [
      "a diagonal",
      [
        [0, 0],
        [1, 1],
        [2, 2],
      ],
    ],
    [
      "the other diagonal",
      [
        [0, 2],
        [1, 1],
        [2, 0],
      ],
    ],
  ])("finds a win on %s", (_name, line) => {
    expect(outcomeOf(boardWith(line))).toEqual({ winner: "O", line });
  });

  it("finds no outcome on an open board", () => {
    expect(
      outcomeOf(
        boardWith([
          [0, 0],
          [1, 1],
        ]),
      ),
    ).toBeNull();
  });

  it("doesn't modify the board it places on", () => {
    const board = emptyBoard();
    placeMark(board, 1, 1, "X");
    expect(board[1][1]).toBeNull();
  });

  it("rejects strangers and non-integer cells", () => {
    expect(
      checkAction(seated(), { type: "place", row: 0, col: 0 }, "stranger"),
    ).toBe("Only seated players can play");
    expect(
      checkAction(seated(), { type: "place", row: 0.5, col: 0 }, "x"),
    ).toBe("That's not a cell");
  });

  it("alternates turns until the game is decided", () => {
    const state = applyAction(seated(), { type: "place", row: 0, col: 0 });
    expect(state.turn).toBe("O");
    expect(checkAction(state, { type: "rematch" }, "x")).toBe(
      "The game isn't over yet",
    );
  });

  it("only accepts a timeout from the system, for the current turn", () => {
    const state = applyAction(seated(), { type: "place", row: 0, col: 0 });
    expect(checkAction(state, { type: "timeout", moves: 1 }, "x")).toBe(
      "Only the system can end a turn",
    );
    expect(checkAction(state, { type: "timeout", moves: 0 }, SYSTEM)).toBe(
      "That turn is over",
    );
    expect(checkAction(state, { type: "timeout", moves: 1 }, SYSTEM)).toBe(
      true,
    );
    expect(applyAction(state, { type: "timeout", moves: 1 }).outcome).toEqual({
      winner: "X",
      timeout: true,
    });
  });

  it("restarts the turn timer on every move, and cancels it at the end", () => {
    const moved = applyAction(
      { ...seated(), turnSeconds: 0.1 },
      { type: "place", row: 0, col: 0 },
    );
    expect(withTurnTimer(moved)).toEqual(
      transition(moved, {
        schedule: [
          { name: "turn", in: 100, action: { type: "timeout", moves: 1 } },
        ],
      }),
    );
    const over = applyAction(moved, { type: "timeout", moves: 1 });
    expect(withTurnTimer(over)).toEqual(transition(over, { cancel: ["turn"] }));
    const unlimited = seated();
    expect(withTurnTimer(unlimited)).toBe(unlimited);
  });
});
