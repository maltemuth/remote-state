/**
 * Tic-tac-toe end to end, through the example's lobby and the library's API:
 * seating, turns, wins, draws, rematches, and live updates on the socket.
 */

import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import { silentLogger, type StateEvent } from "@malte.muth/remote-state";
import { io as connect, type Socket } from "socket.io-client";
import request from "supertest";
import {
  createExampleServer,
  type ExampleServer,
} from "../../src/host/servers.js";
import type { TicTacToeState } from "../../src/games/tic-tac-toe/types.js";
import { newTicTacToeGame } from "../../src/games/tic-tac-toe/rules.js";
import { clientFor } from "../helpers/client.js";

describe("Tic-tac-toe E2E", () => {
  let example: ExampleServer;
  let client: ReturnType<typeof clientFor>;
  let port: number;
  const sockets: Socket[] = [];

  before(async () => {
    example = await createExampleServer({ logger: silentLogger });
    port = await example.listen(0);
    client = clientFor(example.app, "/tic-tac-toe");
  });
  after(async () => {
    sockets.forEach((socket) => socket.disconnect());
    await example.close();
  });

  const place = (gameId: string, token: string, row: number, col: number) =>
    client.act(gameId, token, { type: "place", row, col });

  const seatedGame = async () => {
    const gameId = await client.createGame();
    const x = await client.joinAs(gameId, "Xena");
    const o = await client.joinAs(gameId, "Otto");
    return { gameId, x, o };
  };

  it("seats two players and refuses a third", async () => {
    const { gameId, x, o } = await seatedGame();
    const state = await client.stateFor<TicTacToeState>(gameId, x.token);
    assert.deepEqual(state.seats, {
      X: { playerId: x.playerId, name: "Xena" },
      O: { playerId: o.playerId, name: "Otto" },
    });

    const code = await client.codeFor(gameId, "Third");
    const refused = await client.redeem(code).expect(403);
    assert.equal(refused.body.error, "Both seats are taken");
  });

  it("answers 404 for codes to an unknown game", async () => {
    await request(example.app)
      .post("/tic-tac-toe/lobby/games/nope/codes")
      .send({ name: "Nobody" })
      .expect(404);
  });

  it("waits for an opponent and enforces turns and free cells", async () => {
    const gameId = await client.createGame();
    const x = await client.joinAs(gameId, "Xena");
    assert.equal(
      (await place(gameId, x.token, 0, 0).expect(400)).body.error,
      "Waiting for an opponent",
    );
    const o = await client.joinAs(gameId, "Otto");
    assert.equal(
      (await place(gameId, o.token, 0, 0).expect(400)).body.error,
      "It's not your turn",
    );
    await place(gameId, x.token, 0, 0).expect(201);
    assert.equal(
      (await place(gameId, o.token, 0, 0).expect(400)).body.error,
      "That cell is taken",
    );
    assert.equal(
      (await place(gameId, o.token, 3, 0).expect(400)).body.error,
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

    const won = await client.stateFor<TicTacToeState>(gameId, o.token);
    assert.deepEqual(won.outcome, {
      winner: "X",
      line: [
        [0, 0],
        [0, 1],
        [0, 2],
      ],
    });
    assert.equal(
      (await place(gameId, o.token, 2, 2).expect(400)).body.error,
      "The game is over",
    );

    await client.act(gameId, o.token, { type: "rematch" }).expect(201);
    const rematch = await client.stateFor<TicTacToeState>(gameId, x.token);
    assert.partialDeepStrictEqual(rematch, {
      outcome: null,
      starter: "O",
      turn: "O",
    });
    assert.equal(
      rematch.board.flat().every((cell) => cell === null),
      true,
    );
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
    const state = await client.stateFor<TicTacToeState>(gameId, x.token);
    assert.deepEqual(state.outcome, { winner: null, draw: true });
  });

  it("sends both players every move over the socket", async () => {
    const { gameId, x, o } = await seatedGame();
    const socket = connect(`http://localhost:${port}`, {
      path: "/tic-tac-toe/socket.io",
      auth: { spaceId: gameId, token: o.token },
      transports: ["websocket"],
      reconnection: false,
    });
    sockets.push(socket);
    const next = () =>
      new Promise<StateEvent<TicTacToeState>>((resolve) =>
        socket.once("state", resolve),
      );

    assert.equal((await next()).sequence, 2);
    const update = next();
    await place(gameId, x.token, 1, 1).expect(201);
    const { sequence, state } = await update;
    assert.equal(sequence, 3);
    assert.equal(state.board[1][1], "X");
    assert.equal(state.turn, "O");
  });

  it("ends the game when the player to move runs out of time", async () => {
    const gameId = await example.ticTacToe.createSpace(
      newTicTacToeGame({ turnSeconds: 0.1 }),
    );
    const x = await client.joinAs(gameId, "Xena");
    await client.joinAs(gameId, "Otto");
    const outcome = async () =>
      (await client.stateFor<TicTacToeState>(gameId, x.token)).outcome;

    // X never moves; restarting the timer on each move is covered by the rules tests
    for (let i = 0; i < 100 && !(await outcome()); i++) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    assert.deepEqual(await outcome(), { winner: "O", timeout: true });
  });
});
