/**
 * Battleship end to end, through the example's lobby and the library's API:
 * seating on admission, setup, hidden fleets per player, turns, and a win.
 */

import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { silentLogger } from "@malte.muth/remote-state";
import {
  createExampleServer,
  type ExampleServer,
} from "../../src/host/servers.js";
import type {
  BattleshipAction,
  BattleshipState,
} from "../../src/games/battleship/types.js";
import { clientFor, type Seat } from "../helpers/client.js";

describe("Battleship E2E", () => {
  let example: ExampleServer;
  let client: ReturnType<typeof clientFor>;

  beforeAll(async () => {
    example = await createExampleServer({ logger: silentLogger });
    client = clientFor(example.app, "/battleship");
  });
  afterAll(() => example.close());

  const act = (gameId: string, token: string, action: BattleshipAction) =>
    client.act(gameId, token, action);
  const fire = (gameId: string, token: string, row: number, col: number) =>
    act(gameId, token, { type: "fire_shot", position: [row, col] });
  const view = (gameId: string, seat: Seat) =>
    client.stateFor<BattleshipState>(gameId, seat.token);

  /** Destroyer on row 0 (cols 0-2), battleship on row 1 (cols 0-3) */
  const placeFleet = async (gameId: string, token: string) => {
    await act(gameId, token, {
      type: "place_ship",
      shipType: "destroyer",
      position: [0, 0],
      orientation: "horizontal",
    }).expect(201);
    await act(gameId, token, {
      type: "place_ship",
      shipType: "battleship",
      position: [1, 0],
      orientation: "horizontal",
    }).expect(201);
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
    expect((await view(gameId, p1)).players).toEqual({
      player1: p1.playerId,
      player2: "opponent",
    });
    expect(
      (await act(gameId, p1.token, { type: "join" }).expect(400)).body.error,
    ).toBe("join isn't an action");
    await client.redeem(await client.codeFor(gameId, "Carol")).expect(403);
  });

  it("stays in setup until both fleets are placed", async () => {
    const { gameId, p1, p2 } = await seatedGame();
    await placeFleet(gameId, p1.token);
    expect((await view(gameId, p1)).status).toBe("setup");
    expect((await fire(gameId, p1.token, 0, 0).expect(400)).body.error).toBe(
      "Game is not in playing state",
    );
    await placeFleet(gameId, p2.token);
    expect(await view(gameId, p1)).toMatchObject({
      status: "playing",
      currentPlayer: "player1",
    });
  });

  it("rejects overlapping and out-of-bounds ships", async () => {
    const { gameId, p1 } = await seatedGame();
    const place = (
      shipType: "destroyer" | "battleship",
      position: [number, number],
      vertical = false,
    ) =>
      act(gameId, p1.token, {
        type: "place_ship",
        shipType,
        position,
        orientation: vertical ? "vertical" : "horizontal",
      });
    await place("destroyer", [0, 0]).expect(201);
    expect(
      (await place("battleship", [0, 1], true).expect(400)).body.error,
    ).toBe("Invalid ship placement");
    expect((await place("battleship", [4, 2]).expect(400)).body.error).toBe(
      "Invalid ship placement",
    );
  });

  it("rejects inherited ship types, fractional cells and non-actions", async () => {
    const { gameId, p1 } = await seatedGame();
    const send = (action: unknown) =>
      client.act(gameId, p1.token, action as object).expect(400);
    await send({
      type: "place_ship",
      shipType: "toString",
      position: [0, 0],
      orientation: "horizontal",
    });
    await send({
      type: "place_ship",
      shipType: "destroyer",
      position: [0.5, 0],
      orientation: "horizontal",
    });
    for (const action of [null, 42, "fire_shot", []]) await send(action);
  });

  it("hides the opponent's ships but shows shots", async () => {
    const { gameId, p1, p2 } = await startedGame();
    await fire(gameId, p1.token, 0, 0).expect(201);

    const p1View = await view(gameId, p1);
    expect(p1View.lastMove.result).toBe("hit");
    expect(p1View.currentPlayer).toBe("player2");
    expect(p1View.boards.player2[0][0]).toBe("hit");
    expect(p1View.boards.player2.flat()).not.toContain("ship");
    expect(p1View.ships.player2).toEqual([]);

    const p2View = await view(gameId, p2);
    expect(p2View.boards.player2[0][0]).toBe("hit");
    expect(p2View.boards.player2[0][1]).toBe("ship");
    expect(p2View.ships.player2).toHaveLength(2);
  });

  it("enforces turns and rejects repeat shots", async () => {
    const { gameId, p1, p2 } = await startedGame();
    expect((await fire(gameId, p2.token, 0, 0).expect(400)).body.error).toBe(
      `It's not ${p2.playerId}'s turn`,
    );
    await fire(gameId, p1.token, 0, 0).expect(201);
    await fire(gameId, p2.token, 4, 4).expect(201);
    expect((await fire(gameId, p1.token, 0, 0).expect(400)).body.error).toBe(
      "Position already fired at",
    );
  });

  it("plays to a win and rejects moves afterwards", async () => {
    const { gameId, p1, p2 } = await startedGame();
    const p1Targets: [number, number][] = [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 0],
      [1, 1],
      [1, 2],
      [1, 3],
    ];
    const p2Misses: [number, number][] = [
      [4, 0],
      [4, 1],
      [4, 2],
      [4, 3],
      [4, 4],
      [3, 0],
    ];
    for (const [index, [row, col]] of p1Targets.entries()) {
      await fire(gameId, p1.token, row, col).expect(201);
      if (index < p2Misses.length)
        await fire(gameId, p2.token, ...p2Misses[index]).expect(201);
    }

    const p2View = await view(gameId, p2);
    expect(p2View).toMatchObject({ status: "finished", winner: "player1" });
    expect(p2View.lastMove.result).toBe("sunk");
    expect(p2View.boards.player2[1]).toEqual([
      "sunk",
      "sunk",
      "sunk",
      "sunk",
      "empty",
    ]);
    expect((await fire(gameId, p2.token, 3, 1).expect(400)).body.error).toBe(
      "Game is already finished",
    );
  });
});
