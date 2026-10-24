/**
 * Battleship's rules as plain functions, without a server: seating, placing the
 * classic fleet, turns, hits and sunk ships, the end of a game, restarting, and
 * what each player sees.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Refusal } from "@malte.muth/remote-state";
import {
  executeAction,
  filterStateForPlayer,
  validateAction,
} from "../../../src/games/battleship/engine.js";
import {
  battleshipRules,
  newBattleshipGame,
} from "../../../src/games/battleship/plugin.js";
import { FLEET, HITS, MISSES } from "../../../src/games/battleship/script.js";
import type {
  BattleshipAction,
  BattleshipState,
} from "../../../src/games/battleship/types.js";

const seat = (state: BattleshipState, playerId: string) =>
  battleshipRules.onJoin!(state, {
    memberId: playerId,
    details: {},
  }) as BattleshipState;

/** Validate, then apply; throws with the reason if the action isn't allowed */
const play = (state: BattleshipState, playerId: string, action: unknown) => {
  const check = validateAction(state, action as BattleshipAction, playerId);
  if (check !== true) throw new Error(check);
  return executeAction(state, action as BattleshipAction, playerId);
};

const seated = () => seat(seat(newBattleshipGame(), "alice"), "bob");
const started = () =>
  [...FLEET, ...FLEET].reduce(
    (state, ship, i) => play(state, i < FLEET.length ? "alice" : "bob", ship),
    seated(),
  );
const shot = (row: number, col: number) => ({
  type: "fire_shot",
  position: [row, col],
});
const place = (
  shipType: string,
  position: unknown,
  orientation = "horizontal",
) => ({
  type: "place_ship",
  shipType,
  position,
  orientation,
});

describe("battleship rules", () => {
  it("seats players in admission order and refuses a third", () => {
    const state = seated();
    assert.deepEqual(state.players, { player1: "alice", player2: "bob" });
    assert.throws(() => seat(state, "carol"), Refusal);
  });

  it("only lets seated players act", () => {
    assert.equal(
      validateAction(seated(), FLEET[0], "carol"),
      "Only seated players can act",
    );
  });

  for (const [name, action, reason] of [
    ["an unknown ship", place("canoe", [5, 0]), "Unknown ship type canoe"],
    [
      "an inherited name",
      place("toString", [5, 0]),
      "Unknown ship type toString",
    ],
    [
      "a bad orientation",
      place("cruiser", [5, 0], "diagonal"),
      "Orientation must be horizontal or vertical",
    ],
    [
      "a cell off the board",
      place("cruiser", [10, 0]),
      "Position must be [row, col] between 0 and 9",
    ],
    [
      "a fractional cell",
      place("cruiser", [0.5, 0]),
      "Position must be [row, col] between 0 and 9",
    ],
    [
      "a ship sticking out",
      place("battleship", [5, 7]),
      "Invalid ship placement",
    ],
    [
      "an overlap",
      place("battleship", [0, 2], "vertical"),
      "Invalid ship placement",
    ],
    ["the same ship twice", place("carrier", [5, 0]), "carrier already placed"],
    ["a non-action", null, "Unknown action type undefined"],
  ] as [string, unknown, string][])
    it(`rejects placing ${name}`, () => {
      const state = play(seated(), "alice", FLEET[0]);
      assert.equal(
        validateAction(state, action as BattleshipAction, "alice"),
        reason,
      );
    });

  it("lets ships touch, and starts once both fleets are complete", () => {
    const touching = play(play(seated(), "alice", FLEET[0]), "alice", FLEET[1]);
    assert.deepEqual(touching.boards.player1[1].slice(0, 5), [
      "ship",
      "ship",
      "ship",
      "ship",
      "empty",
    ]);
    assert.equal(touching.status, "setup");

    const state = started();
    assert.partialDeepStrictEqual(state, {
      status: "playing",
      currentPlayer: "player1",
    });
    assert.equal(
      validateAction(
        state,
        place("carrier", [5, 0]) as BattleshipAction,
        "alice",
      ),
      "Ships can only be placed during setup",
    );
  });

  it("takes turns, marks hits and misses, and rejects repeat shots", () => {
    let state = play(started(), "alice", shot(0, 0));
    assert.equal(state.boards.player2[0][0], "hit");
    assert.deepEqual(state.lastMove, {
      player: "player1",
      action: "fire_shot",
      position: [0, 0],
      result: "hit",
    });
    assert.equal(
      validateAction(state, shot(9, 9) as BattleshipAction, "alice"),
      "It's not alice's turn",
    );
    state = play(state, "bob", shot(9, 9));
    assert.equal(state.boards.player1[9][9], "miss");
    assert.equal(
      validateAction(state, shot(0, 0) as BattleshipAction, "alice"),
      "Position already fired at",
    );
  });

  it("sinks a ship once every cell is hit", () => {
    // The destroyer, row 4, two cells
    let state = play(started(), "alice", shot(4, 0));
    state = play(state, "bob", shot(9, 9));
    state = play(state, "alice", shot(4, 1));
    assert.equal(state.lastMove?.result, "sunk");
    assert.deepEqual(state.boards.player2[4].slice(0, 3), [
      "sunk",
      "sunk",
      "empty",
    ]);
    assert.equal(
      state.ships.player2.find((s) => s.type === "destroyer")?.sunk,
      true,
    );
  });

  it("ends when a whole fleet is sunk, then only allows a restart", () => {
    let state = started();
    for (const [i, [row, col]] of HITS.entries()) {
      state = play(state, "alice", shot(row, col));
      if (i < MISSES.length) state = play(state, "bob", shot(...MISSES[i]));
    }
    assert.partialDeepStrictEqual(state, {
      status: "finished",
      winner: "player1",
    });
    assert.equal(
      validateAction(state, shot(5, 5) as BattleshipAction, "bob"),
      "Game is already finished",
    );

    const restarted = play(state, "bob", { type: "restart" });
    assert.deepEqual(restarted, {
      ...newBattleshipGame(),
      players: state.players,
    });
  });

  it("leaves the state it is given unchanged", () => {
    const state = started();
    const before = JSON.stringify(state);
    play(state, "alice", shot(0, 0));
    assert.equal(JSON.stringify(state), before);
  });

  it("shows each player their own ships, and the opponent's only when hit", () => {
    const state = play(started(), "alice", shot(0, 0));
    const alice = filterStateForPlayer(state, "alice");
    assert.deepEqual(alice.boards.player1, state.boards.player1);
    assert.ok(!alice.boards.player2.flat().includes("ship"));
    assert.equal(alice.boards.player2[0][0], "hit");
    assert.deepEqual(alice.ships, {
      player1: state.ships.player1,
      player2: [],
    });
    assert.deepEqual(alice.players, { player1: "alice", player2: "opponent" });

    const carol = filterStateForPlayer(state, "carol");
    assert.ok(
      ![...carol.boards.player1, ...carol.boards.player2]
        .flat()
        .includes("ship"),
    );
    assert.deepEqual(carol.players, {
      player1: "opponent",
      player2: "opponent",
    });
  });
});
