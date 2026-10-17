/**
 * Tic-tac-toe's rules as plain functions: outcomes on every kind of line, and
 * action checks, without a server.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
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
  for (const [name, line] of [
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
  ] as [string, Position[]][])
    it(`finds a win on ${name}`, () => {
      assert.deepEqual(outcomeOf(boardWith(line)), { winner: "O", line });
    });

  it("finds no outcome on an open board", () => {
    assert.equal(
      outcomeOf(
        boardWith([
          [0, 0],
          [1, 1],
        ]),
      ),
      null,
    );
  });

  it("doesn't modify the board it places on", () => {
    const board = emptyBoard();
    placeMark(board, 1, 1, "X");
    assert.equal(board[1][1], null);
  });

  it("rejects strangers and non-integer cells", () => {
    assert.equal(
      checkAction(seated(), { type: "place", row: 0, col: 0 }, "stranger"),
      "Only seated players can play",
    );
    assert.equal(
      checkAction(seated(), { type: "place", row: 0.5, col: 0 }, "x"),
      "That's not a cell",
    );
  });

  it("alternates turns until the game is decided", () => {
    const state = applyAction(seated(), { type: "place", row: 0, col: 0 });
    assert.equal(state.turn, "O");
    assert.equal(
      checkAction(state, { type: "rematch" }, "x"),
      "The game isn't over yet",
    );
  });

  it("only accepts a timeout from the system, for the current turn", () => {
    const state = applyAction(seated(), { type: "place", row: 0, col: 0 });
    assert.equal(
      checkAction(state, { type: "timeout", moves: 1 }, "x"),
      "Only the system can end a turn",
    );
    assert.equal(
      checkAction(state, { type: "timeout", moves: 0 }, SYSTEM),
      "That turn is over",
    );
    assert.equal(
      checkAction(state, { type: "timeout", moves: 1 }, SYSTEM),
      true,
    );
    assert.deepEqual(
      applyAction(state, { type: "timeout", moves: 1 }).outcome,
      {
        winner: "X",
        timeout: true,
      },
    );
  });

  it("restarts the turn timer on every move, and cancels it at the end", () => {
    const moved = applyAction(
      { ...seated(), turnSeconds: 0.1 },
      { type: "place", row: 0, col: 0 },
    );
    assert.deepEqual(
      withTurnTimer(moved),
      transition(moved, {
        schedule: [
          { name: "turn", in: 100, action: { type: "timeout", moves: 1 } },
        ],
      }),
    );
    const over = applyAction(moved, { type: "timeout", moves: 1 });
    assert.deepEqual(
      withTurnTimer(over),
      transition(over, { cancel: ["turn"] }),
    );
    const unlimited = seated();
    assert.equal(withTurnTimer(unlimited), unlimited);
  });
});
