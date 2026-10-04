# Test a game plugin

A plugin is a set of plain functions, so you can test the rules without a server. Add a few end-to-end tests through the HTTP API to cover what the server adds: admission, authentication, filtering, and state history.

The examples use the rock-paper-scissors game from the [tutorial](../tutorials/build-your-first-game.md), with the plugin and `newGame` exported from their own module.

## Unit-test the rules

Call the functions directly:

```ts
import { GameRefusal } from "@malte.muth/remote-state";
import { rockPaperScissors } from "../src/rps.js";

const playing = { players: ["a", "b"], names: {}, choices: {}, winner: null };

it("rejects a second choice", async () => {
  const state = { ...playing, choices: { a: "rock" as const } };
  expect(
    await rockPaperScissors.validateAction(
      state,
      { type: "choose", choice: "paper" },
      "a",
    ),
  ).toBe("You already chose");
});

it("refuses a third player", () => {
  expect(() =>
    rockPaperScissors.onJoin!(playing, { playerId: "c", details: {} }),
  ).toThrow(GameRefusal);
});
```

Test `validateAction` and `executeAction` separately. The server never calls `executeAction` with an action that failed validation.

## Test through the API

Create a server on port `0` with an in-memory database, and drive it with [supertest](https://github.com/ladjs/supertest). You don't need to call `startServer()`, because supertest calls the Express app directly.

Your tests act as the host: they create games and admit players by calling the server directly, then use the HTTP API as a client would.

```ts
import request from "supertest";
import { createRemoteStateServer, LogLevel } from "@malte.muth/remote-state";
import { newGame, rockPaperScissors } from "../src/rps.js";

let server;

beforeAll(async () => {
  server = await createRemoteStateServer(
    {
      ...rockPaperScissors,
      serverConfiguration: { minimumLogLevel: LogLevel.error },
    },
    0,
  );
});

afterAll(() => server.shutdown(false)); // false: don't exit the test process

// What a host and its client do together: admit someone and redeem the code
const join = async (gameId, name) => {
  const code = await server.admit({ gameId, identity: { id: name, name } });
  return (
    await request(server.app).post("/api/tokens").send({ code }).expect(201)
  ).body;
};

it("hides the opponent's choice", async () => {
  const gameId = await server.createGame(newGame());
  const alice = await join(gameId, "alice");
  const bob = await join(gameId, "bob");

  await request(server.app)
    .post(`/api/games/${gameId}/actions`)
    .set("Authorization", `Bearer ${alice.token}`)
    .send({ action: { type: "choose", choice: "rock" } })
    .expect(201);

  const bobView = await request(server.app)
    .get(`/api/games/${gameId}/state`)
    .set("Authorization", `Bearer ${bob.token}`)
    .expect(200);
  expect(bobView.body.state.choices).toEqual({});
  expect(bobView.body.state.opponentHasChosen).toBe(true);
});
```

Pass `false` to `shutdown`, otherwise it calls `process.exit` and ends the test run.

If your host adds its own routes, as the example's lobby does, test through those instead of calling `admit` directly.

## Test socket updates

Call `startServer()`, read the port from `server.server.address().port`, and connect with `socket.io-client`. [socket.test.ts](../../packages/remote-state/__test__/integration/socket.test.ts) has complete examples, including how to wait for events and how to apply patches with Immer.

## Examples in this repository

- [tic-tac-toe.e2e.test.ts](../../packages/remote-state-example-server/__test__/e2e/tic-tac-toe.e2e.test.ts): a full game through the example's lobby and the library's API, using the library through its package name as your project would. Its [client helpers](../../packages/remote-state-example-server/__test__/helpers/client.ts) do what a browser client does.
- [rules.test.ts](../../packages/remote-state-example-server/__test__/games/tic-tac-toe/rules.test.ts): tic-tac-toe's rules, tested without a server
- [jest.config.js](../../packages/remote-state-example-server/jest.config.js): Jest running TypeScript as native ESM. The tests run with `NODE_OPTIONS=--experimental-vm-modules`, which Jest's ESM mode needs.
- [admission.test.ts](../../packages/remote-state/__test__/integration/admission.test.ts) and [updates.test.ts](../../packages/remote-state/__test__/integration/updates.test.ts): codes, the join hook, refusals, audiences and catch-up, using a small [counter game](../../packages/remote-state/__test__/helpers/counterGame.ts)
