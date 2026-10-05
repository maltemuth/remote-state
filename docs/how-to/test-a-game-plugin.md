# Test a game plugin

A plugin is a set of plain functions, so you can test the rules without a server. Add a few end-to-end tests through the HTTP API to cover what the server adds: admission, authentication, filtering, and state history.

The examples use the rock-paper-scissors game from the [tutorial](../tutorials/build-your-first-game.md), with the plugin, `newGame` and the `RpsState` type exported from their own module.

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

Create a server with an in-memory database, the default, and drive it with [supertest](https://github.com/ladjs/supertest). You don't need to call `startServer()`, because supertest calls the Express app directly.

Your tests act as the host: they create games and admit players by calling the server directly, then use the HTTP API as a client would.

```ts
import request from "supertest";
import {
  createRemoteStateServer,
  type RemoteStateServer,
  silentLogger,
} from "@malte.muth/remote-state";
import { newGame, rockPaperScissors, type RpsState } from "../src/rps.js";

let server: RemoteStateServer<RpsState>;

beforeAll(async () => {
  server = await createRemoteStateServer(rockPaperScissors, {
    logger: silentLogger,
  });
});

afterAll(() => server.close());

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

`silentLogger` keeps the server's output out of the test report. To see only errors, pass `consoleLogger({ level: LogLevel.error })` instead.

If your host adds its own routes, as the example's lobby does, test through those instead of calling `admit` directly.

## Test socket updates

Create the server with `port: 0`, call `startServer()`, which resolves to the port it picked, and connect with `socket.io-client`. [socket.test.ts](../../packages/remote-state/__test__/integration/socket.test.ts) has complete examples, including how to wait for events and how to apply patches with Immer.

## Examples in this repository

- [tic-tac-toe.e2e.test.ts](../../packages/remote-state-example-server/__test__/e2e/tic-tac-toe.e2e.test.ts): a full game through the example's lobby and the library's API, using the library through its package name as your project would. Its [client helpers](../../packages/remote-state-example-server/__test__/helpers/client.ts) do what a browser client does.
- [rules.test.ts](../../packages/remote-state-example-server/__test__/games/tic-tac-toe/rules.test.ts): tic-tac-toe's rules, tested without a server
- [jest.config.base.js](../../jest.config.base.js), which the example's `jest.config.js` re-exports: Jest running TypeScript as native ESM. The tests run with `NODE_OPTIONS=--experimental-vm-modules`, which Jest's ESM mode needs.
- [admission.test.ts](../../packages/remote-state/__test__/integration/admission.test.ts) and [updates.test.ts](../../packages/remote-state/__test__/integration/updates.test.ts): codes, the join hook, refusals, audiences and catch-up, using a small [counter game](../../packages/remote-state/__test__/helpers/counterGame.ts)
