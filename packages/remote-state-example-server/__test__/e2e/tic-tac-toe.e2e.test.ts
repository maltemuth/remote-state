/**
 * Tic-tac-toe end to end, through the example's lobby and the library's API:
 * seating, turns, wins, draws, rematches, and live updates on the socket.
 */

import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import {
  LogLevel,
  setGlobalLogLevel,
  type StateEvent,
} from "@malte.muth/remote-state";
import request from "supertest";
import { io as connect, type Socket } from "socket.io-client";
import { createTicTacToeServer } from "../../src/host/servers.js";
import type { TicTacToeState } from "../../src/games/tic-tac-toe/types.js";
import { act, createGame, joinAs, stateFor } from "../helpers/client.js";

describe("Tic-tac-toe E2E", () => {
  let server: Awaited<ReturnType<typeof createTicTacToeServer>>;
  const sockets: Socket[] = [];

  beforeAll(async () => {
    setGlobalLogLevel(LogLevel.error);
    server = await createTicTacToeServer(0);
    await server.startServer();
  });
  afterAll(async () => {
    sockets.forEach((socket) => socket.disconnect());
    await server.shutdown(false);
  });

  const place = (gameId: string, token: string, row: number, col: number) =>
    act(server.app, gameId, token, { type: "place", row, col });

  const seatedGame = async () => {
    const gameId = await createGame(server.app);
    const x = await joinAs(server.app, gameId, "Xena");
    const o = await joinAs(server.app, gameId, "Otto");
    return { gameId, x, o };
  };

  it("seats two players and refuses a third", async () => {
    const { gameId, x, o } = await seatedGame();
    const state = await stateFor<TicTacToeState>(server.app, gameId, x.token);
    expect(state.seats).toEqual({
      X: { playerId: x.playerId, name: "Xena" },
      O: { playerId: o.playerId, name: "Otto" },
    });

    const { code } = (
      await request(server.app)
        .post(`/lobby/games/${gameId}/codes`)
        .send({ name: "Third" })
    ).body;
    const refused = await request(server.app)
      .post("/api/tokens")
      .send({ code })
      .expect(403);
    expect(refused.body.error).toBe("Both seats are taken");
  });

  it("waits for an opponent and enforces turns and free cells", async () => {
    const gameId = await createGame(server.app);
    const x = await joinAs(server.app, gameId, "Xena");
    expect((await place(gameId, x.token, 0, 0).expect(400)).body.error).toBe(
      "Waiting for an opponent",
    );
    const o = await joinAs(server.app, gameId, "Otto");
    expect((await place(gameId, o.token, 0, 0).expect(400)).body.error).toBe(
      "It's not your turn",
    );
    await place(gameId, x.token, 0, 0).expect(201);
    expect((await place(gameId, o.token, 0, 0).expect(400)).body.error).toBe(
      "That cell is taken",
    );
    expect((await place(gameId, o.token, 3, 0).expect(400)).body.error).toBe(
      "That's not a cell",
    );
  });

  it("plays to a win, then a rematch started by O", async () => {
    const { gameId, x, o } = await seatedGame();
    const moves: [typeof x, number, number][] = [
      [x, 0, 0],
      [o, 1, 0],
      [x, 0, 1],
      [o, 1, 1],
      [x, 0, 2],
    ];
    for (const [seat, row, col] of moves)
      await place(gameId, seat.token, row, col).expect(201);

    const won = await stateFor<TicTacToeState>(server.app, gameId, o.token);
    expect(won.outcome).toEqual({
      winner: "X",
      line: [
        [0, 0],
        [0, 1],
        [0, 2],
      ],
    });
    expect((await place(gameId, o.token, 2, 2).expect(400)).body.error).toBe(
      "The game is over",
    );

    await act(server.app, gameId, o.token, { type: "rematch" }).expect(201);
    const rematch = await stateFor<TicTacToeState>(server.app, gameId, x.token);
    expect(rematch).toMatchObject({ outcome: null, starter: "O", turn: "O" });
    expect(rematch.board.flat().every((cell) => cell === null)).toBe(true);
  });

  it("detects a draw", async () => {
    const { gameId, x, o } = await seatedGame();
    // X O X / X O O / O X X
    const moves: [typeof x, number, number][] = [
      [x, 0, 0],
      [o, 0, 1],
      [x, 0, 2],
      [o, 1, 1],
      [x, 1, 0],
      [o, 1, 2],
      [x, 2, 1],
      [o, 2, 0],
      [x, 2, 2],
    ];
    for (const [seat, row, col] of moves)
      await place(gameId, seat.token, row, col).expect(201);
    const state = await stateFor<TicTacToeState>(server.app, gameId, x.token);
    expect(state.outcome).toEqual({ winner: null, draw: true });
  });

  it("sends both players every move over the socket", async () => {
    const { gameId, x, o } = await seatedGame();
    const address = server.server.address() as { port: number };
    const socket = connect(`http://localhost:${address.port}`, {
      auth: { gameId, token: o.token },
      transports: ["websocket"],
      reconnection: false,
    });
    sockets.push(socket);
    const next = () =>
      new Promise<StateEvent<TicTacToeState>>((resolve) =>
        socket.once("state", resolve),
      );

    expect((await next()).sequence).toBe(2);
    const update = next();
    await place(gameId, x.token, 1, 1).expect(201);
    const { sequence, state } = await update;
    expect(sequence).toBe(3);
    expect(state.board[1][1]).toBe("X");
    expect(state.turn).toBe("O");
  });
});
