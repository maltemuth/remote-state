/**
 * Battleship end to end, through the example's lobby and the library's API:
 * seating on admission, setup, hidden fleets per player, turns, and a win.
 */

import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import { silentLogger } from "@malte.muth/remote-state";
import {
  createExampleServer,
  type ExampleServer,
} from "../../src/host/servers.js";
import { FLEET, HITS, MISSES } from "../../src/games/battleship/script.js";
import type { BattleshipState } from "../../src/games/battleship/types.js";
import { clientFor, type Seat } from "../helpers/client.js";

describe("Battleship E2E", () => {
  let example: ExampleServer;
  let client: ReturnType<typeof clientFor>;

  before(async () => {
    example = await createExampleServer({ logger: silentLogger });
    client = clientFor(example.app, "/battleship");
  });
  after(() => example.close());

  const act = (gameId: string, token: string, action: unknown) =>
    client.act(gameId, token, action as object);
  const fire = (gameId: string, token: string, row: number, col: number) =>
    act(gameId, token, { type: "fire_shot", position: [row, col] });
  const view = (gameId: string, seat: Seat) =>
    client.stateFor<BattleshipState>(gameId, seat.token);

  /** Each ship in its own row, from the top left */
  const placeFleet = async (gameId: string, token: string) => {
    for (const ship of FLEET) await act(gameId, token, ship).expect(201);
  };

  /** The first person admitted is player1, the second player2 */
  const seatedGame = async () => {
    const gameId = await client.createGame();
    const p1 = await client.joinAs(gameId, "Alice");
    const p2 = await client.joinAs(gameId, "Bob");
    return { gameId, p1, p2 };
  };

  const startedGame = async () => {
    const game = await seatedGame();
    await placeFleet(game.gameId, game.p1.token);
    await placeFleet(game.gameId, game.p2.token);
    return game;
  };

  it("seats players on admission and refuses a third", async () => {
    const { gameId, p1 } = await seatedGame();
    assert.deepEqual((await view(gameId, p1)).players, {
      player1: p1.playerId,
      player2: "opponent",
    });
    assert.equal(
      (await act(gameId, p1.token, { type: "join" }).expect(400)).body.error,
      "Unknown action type join",
    );
    await client.redeem(await client.codeFor(gameId, "Carol")).expect(403);
  });

  it("stays in setup until both fleets are placed", async () => {
    const { gameId, p1, p2 } = await seatedGame();
    await placeFleet(gameId, p1.token);
    assert.equal((await view(gameId, p1)).status, "setup");
    assert.equal(
      (await fire(gameId, p1.token, 0, 0).expect(400)).body.error,
      "Game is not in playing state",
    );
    await placeFleet(gameId, p2.token);
    assert.partialDeepStrictEqual(await view(gameId, p1), {
      status: "playing",
      currentPlayer: "player1",
    });
  });

  it("rejects overlapping, out-of-bounds and invalid ships", async () => {
    const { gameId, p1 } = await seatedGame();
    const place = (
      shipType: string,
      position: unknown,
      orientation = "horizontal",
    ) =>
      act(gameId, p1.token, {
        type: "place_ship",
        shipType,
        position,
        orientation,
      });
    await place("carrier", [0, 0]).expect(201);
    const error = async (request: ReturnType<typeof place>) =>
      (await request.expect(400)).body.error;
    assert.equal(
      await error(place("battleship", [0, 2], "vertical")),
      "Invalid ship placement",
    );
    assert.equal(
      await error(place("battleship", [9, 7])),
      "Invalid ship placement",
    );
    assert.equal(
      await error(place("toString", [5, 0])),
      "Unknown ship type toString",
    );
    assert.equal(
      await error(place("cruiser", [0.5, 0])),
      "Position must be [row, col] between 0 and 9",
    );
    for (const action of [null, 42, "fire_shot", []]) {
      await act(gameId, p1.token, action).expect(400);
    }
    // Touching ships are fine
    await place("battleship", [1, 0]).expect(201);
  });

  it("hides the opponent's ships but shows shots", async () => {
    const { gameId, p1, p2 } = await startedGame();
    await fire(gameId, p1.token, 0, 0).expect(201);

    const p1View = await view(gameId, p1);
    assert.equal(p1View.lastMove?.result, "hit");
    assert.equal(p1View.currentPlayer, "player2");
    assert.equal(p1View.boards.player2[0][0], "hit");
    assert.ok(!p1View.boards.player2.flat().includes("ship"));
    assert.deepEqual(p1View.ships.player2, []);

    const p2View = await view(gameId, p2);
    assert.equal(p2View.boards.player2[0][0], "hit");
    assert.equal(p2View.boards.player2[0][1], "ship");
    assert.equal(p2View.ships.player2.length, FLEET.length);
  });

  it("enforces turns and rejects repeat shots", async () => {
    const { gameId, p1, p2 } = await startedGame();
    assert.equal(
      (await fire(gameId, p2.token, 0, 0).expect(400)).body.error,
      `It's not ${p2.playerId}'s turn`,
    );
    await fire(gameId, p1.token, 0, 0).expect(201);
    await fire(gameId, p2.token, 9, 9).expect(201);
    assert.equal(
      (await fire(gameId, p1.token, 0, 0).expect(400)).body.error,
      "Position already fired at",
    );
  });

  it("plays to a win and rejects moves afterwards", async () => {
    const { gameId, p1, p2 } = await startedGame();
    for (const [index, [row, col]] of HITS.entries()) {
      await fire(gameId, p1.token, row, col).expect(201);
      if (index < MISSES.length)
        await fire(gameId, p2.token, ...MISSES[index]).expect(201);
    }

    const p2View = await view(gameId, p2);
    assert.partialDeepStrictEqual(p2View, {
      status: "finished",
      winner: "player1",
    });
    assert.equal(p2View.lastMove?.result, "sunk");
    assert.deepEqual(p2View.boards.player2[1].slice(0, 5), [
      "sunk",
      "sunk",
      "sunk",
      "sunk",
      "empty",
    ]);
    assert.equal(
      (await fire(gameId, p2.token, 5, 5).expect(400)).body.error,
      "Game is already finished",
    );
  });
});
