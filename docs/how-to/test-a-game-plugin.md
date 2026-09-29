# Test a game plugin

A plugin is a set of async functions, so you can test the rules without a server. Add a few end-to-end tests through the HTTP API to cover what the server adds: authentication, filtering, and state history.

## Unit-test the rules

Call the functions directly:

```ts
import { rockPaperScissors } from "../src/rps";

it("rejects a second choice", async () => {
  const state = { players: ["a", "b"], choices: { a: "rock" }, winner: null };
  expect(await rockPaperScissors.validateAction(state, { type: "choose", choice: "paper" }, "a"))
    .toBe("You already chose");
});
```

Test `validateAction` and `executeAction` separately. The server never calls `executeAction` with an action that failed validation.

## Test through the API

Create a server on port `0` with an in-memory database, and drive it with [supertest](https://github.com/ladjs/supertest). You don't need to call `startServer()`, because supertest calls the Express app directly:

```ts
import request from "supertest";
import { createRemoteStateServer, LogLevel } from "@malte.muth/remote-state";

let server;

beforeAll(async () => {
  server = await createRemoteStateServer(
    { ...rockPaperScissors, serverConfiguration: { minimumLogLevel: LogLevel.error } },
    0
  );
});

afterAll(() => server.shutdown(false)); // false: don't exit the test process

it("hides the opponent's choice", async () => {
  const alice = (await request(server.app).post("/api/games")
    .send({ gameName: "t", playerName: "Alice" })).body;
  const bob = (await request(server.app).post(`/api/games/${alice.gameId}/players`)
    .send({ playerName: "Bob" })).body;

  const act = (token, action) =>
    request(server.app).post(`/api/games/${alice.gameId}/actions`)
      .set("Authorization", `Bearer ${token}`).send({ action }).expect(201);

  await act(alice.token, { type: "join" });
  await act(bob.token, { type: "join" });
  await act(alice.token, { type: "choose", choice: "rock" });

  const bobView = await request(server.app)
    .get(`/api/games/${alice.gameId}/state/current`)
    .set("Authorization", `Bearer ${bob.token}`);
  expect(bobView.body.state.choices).toEqual({});
  expect(bobView.body.state.opponentHasChosen).toBe(true);
});
```

Pass `false` to `shutdown`, otherwise it calls `process.exit` and ends the test run.

## Test socket updates

Call `startServer()`, read the port from `server.server.address().port`, and connect with `socket.io-client`. [socket-manager.test.ts](../../packages/remote-state/__test__/integration/socket-manager.test.ts) has complete examples, including how to wait for events.

## Examples in this repository

- [tic-tac-toe.e2e.test.ts](../../packages/remote-state/__test__/e2e/tic-tac-toe.e2e.test.ts): a full game through the API
- [server.test.ts](../../packages/remote-state/__test__/integration/server.test.ts): authentication, filtering, concurrency and persistence, using a minimal [counter game](../../packages/remote-state/__test__/helpers/counterGame.ts)
