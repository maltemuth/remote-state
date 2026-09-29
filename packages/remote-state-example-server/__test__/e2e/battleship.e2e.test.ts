import request from "supertest";
import { describe, beforeAll, afterAll, it, expect } from "@jest/globals";
import {
  createRemoteStateServer,
  LogLevel,
  type RemoteStateServer,
} from "@malte.muth/remote-state";
import { battleshipPlugin } from "../../src/games/battleship/plugin.js";
import {
  BattleshipAction,
  BattleshipState,
} from "../../src/games/battleship/types.js";

describe("Battleship E2E", () => {
  let server: RemoteStateServer<
    BattleshipState,
    BattleshipAction,
    BattleshipState
  >;

  const act = (gameId: string, token: string, action: BattleshipAction) =>
    request(server.app)
      .post(`/api/games/${gameId}/actions`)
      .send({ action, token });

  const fire = (gameId: string, token: string, row: number, col: number) =>
    act(gameId, token, { type: "fire_shot", position: [row, col] });

  const stateFor = async (gameId: string, token: string) =>
    (
      await request(server.app)
        .get(`/api/games/${gameId}/state/current`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200)
    ).body.state as BattleshipState;

  /** Destroyer on row 0 (cols 0-2), battleship on row 1 (cols 0-3) */
  const placeFleet = async (gameId: string, token: string) => {
    await act(gameId, token, {
      type: "place_ship",
      shipType: "destroyer",
      position: [0, 0],
      orientation: "horizontal",
    }).expect(201);
    return act(gameId, token, {
      type: "place_ship",
      shipType: "battleship",
      position: [1, 0],
      orientation: "horizontal",
    }).expect(201);
  };

  /** Create a game, register a second player, and seat both (owner as player1) */
  const seatedGame = async () => {
    const owner = await request(server.app)
      .post("/api/games")
      .send({ playerName: "Alice", gameName: "E2E battleship" })
      .expect(201);
    const { gameId } = owner.body;
    const joiner = await request(server.app)
      .post(`/api/games/${gameId}/players`)
      .send({ playerName: "Bob" })
      .expect(201);

    const p1 = {
      id: owner.body.playerId as string,
      token: owner.body.token as string,
    };
    const p2 = {
      id: joiner.body.playerId as string,
      token: joiner.body.token as string,
    };
    await act(gameId, p1.token, { type: "join" }).expect(201);
    await act(gameId, p2.token, { type: "join" }).expect(201);
    return { gameId: gameId as string, p1, p2 };
  };

  const startedGame = async () => {
    const game = await seatedGame();
    await placeFleet(game.gameId, game.p1.token);
    await placeFleet(game.gameId, game.p2.token);
    return game;
  };

  beforeAll(async () => {
    server = await createRemoteStateServer(
      {
        ...battleshipPlugin,
        serverConfiguration: { minimumLogLevel: LogLevel.error },
      },
      0,
    );
  });

  afterAll(async () => {
    await server.shutdown(false);
  });

  it("stays in setup until both fleets are placed", async () => {
    const { gameId, p1, p2 } = await seatedGame();

    const afterP1 = await placeFleet(gameId, p1.token);
    expect(afterP1.body.status).toBe("setup");
    expect((await fire(gameId, p1.token, 0, 0).expect(400)).body.error).toBe(
      "Game is not in playing state",
    );

    const afterP2 = await placeFleet(gameId, p2.token);
    expect(afterP2.body.status).toBe("playing");
    expect(afterP2.body.currentPlayer).toBe("player1");
  });

  it("rejects overlapping and out-of-bounds ships", async () => {
    const { gameId, p1 } = await seatedGame();
    await act(gameId, p1.token, {
      type: "place_ship",
      shipType: "destroyer",
      position: [0, 0],
      orientation: "horizontal",
    }).expect(201);

    const overlapping = await act(gameId, p1.token, {
      type: "place_ship",
      shipType: "battleship",
      position: [0, 1],
      orientation: "vertical",
    }).expect(400);
    expect(overlapping.body.error).toBe("Invalid ship placement");

    const tooLong = await act(gameId, p1.token, {
      type: "place_ship",
      shipType: "battleship",
      position: [4, 2],
      orientation: "horizontal",
    }).expect(400);
    expect(tooLong.body.error).toBe("Invalid ship placement");
  });

  it("hides the opponent's ships but shows shots", async () => {
    const { gameId, p1, p2 } = await startedGame();

    const shot = await fire(gameId, p1.token, 0, 0).expect(201);
    expect(shot.body.lastMove.result).toBe("hit");
    expect(shot.body.currentPlayer).toBe("player2");

    const p1View = await stateFor(gameId, p1.token);
    expect(p1View.boards.player2[0][0]).toBe("hit");
    expect(p1View.boards.player2.flat()).not.toContain("ship");
    expect(p1View.ships.player2).toEqual([]);
    expect(p1View.players).toEqual({ player1: p1.id, player2: "opponent" });

    const p2View = await stateFor(gameId, p2.token);
    expect(p2View.boards.player2[0][0]).toBe("hit");
    expect(p2View.boards.player2[0][1]).toBe("ship");
    expect(p2View.ships.player2).toHaveLength(2);
  });

  it("enforces turns and rejects repeat shots", async () => {
    const { gameId, p1, p2 } = await startedGame();

    expect((await fire(gameId, p2.token, 0, 0).expect(400)).body.error).toBe(
      `It's not ${p2.id}'s turn`,
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

    let last;
    for (const [index, [row, col]] of p1Targets.entries()) {
      last = await fire(gameId, p1.token, row, col).expect(201);
      if (index < p2Misses.length) {
        await fire(gameId, p2.token, ...p2Misses[index]).expect(201);
      }
    }

    expect(last!.body.status).toBe("finished");
    expect(last!.body.winner).toBe("player1");
    expect(last!.body.lastMove.result).toBe("sunk");

    const p2View = await stateFor(gameId, p2.token);
    expect(p2View.winner).toBe("player1");
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
