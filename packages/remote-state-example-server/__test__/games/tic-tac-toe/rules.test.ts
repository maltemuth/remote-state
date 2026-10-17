/**
 * Tic-tac-toe's rules as plain functions: outcomes on every kind of line, action
 * checks, and the pause after a restart, without a server.
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
  pauseOnRestart,
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

describe("tic-tac-toe across a restart", () => {
  const running = { ...seated(), turnSeconds: 0.1 };

  it("pauses a game whose turn timer was running", () => {
    assert.equal(pauseOnRestart(running).paused, true);
  });

  it("leaves other games as they were, the same object", () => {
    const over = applyAction(running, { type: "timeout", moves: 0 });
    const waiting = newTicTacToeGame({ turnSeconds: 0.1 });
    const paused = pauseOnRestart(running);
    for (const state of [seated(), over, waiting, paused]) {
      assert.equal(pauseOnRestart(state), state);
    }
  });

  it("lets nothing happen until the host resumes it", () => {
    const paused = pauseOnRestart(running);
    for (const [action, playerId] of [
      [{ type: "place", row: 0, col: 0 }, "x"],
      [{ type: "timeout", moves: 0 }, SYSTEM],
    ] as const) {
      assert.equal(checkAction(paused, action, playerId), "The game is paused");
    }
    assert.equal(
      checkAction(paused, { type: "resume" }, "x"),
      "Only the host can resume the game",
    );
    assert.equal(
      checkAction(running, { type: "resume" }, SYSTEM),
      "The game isn't paused",
    );
    assert.equal(checkAction(paused, { type: "resume" }, SYSTEM), true);
  });

  it("starts the turn over with its full time when resumed", () => {
    const paused = pauseOnRestart(running);
    assert.equal(withTurnTimer(paused), paused);
    const resumed = applyAction(paused, { type: "resume" });
    assert.deepEqual(
      withTurnTimer(resumed),
      transition(resumed, {
        schedule: [
          { name: "turn", in: 100, action: { type: "timeout", moves: 0 } },
        ],
      }),
    );
  });
});
