# Test a game plugin

## Unit-test the rules

A plugin is plain functions, so call them directly. Test `validateAction` and `executeAction` separately: the server never executes an action that failed validation.

```ts
import assert from "node:assert/strict";
import { it } from "node:test";
import { GameRefusal } from "@malte.muth/remote-state";

it("rejects a second choice", async () => {
  const state = {
    players: ["a", "b"],
    names: {},
    choices: { a: "rock" },
    winner: null,
  };
  assert.equal(
    await rockPaperScissors.validateAction(
      state,
      { type: "choose", choice: "paper" },
      "a",
    ),
    "You already chose",
  );
});

it("refuses a third player", () => {
  const full = { players: ["a", "b"], names: {}, choices: {}, winner: null };
  assert.throws(
    () => rockPaperScissors.onJoin!(full, { playerId: "c", details: {} }),
    GameRefusal,
  );
});
```

## Test through the API

Use an in-memory server, the default, and drive its app with [supertest](https://github.com/ladjs/supertest); there's no need to start it. The test plays the host, then the client:

```ts
const server = await createRemoteStateServer(rockPaperScissors, {
  logger: silentLogger,
});
after(() => server.close());

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
  const { body } = await request(server.app)
    .get(`/api/games/${gameId}/state`)
    .set("Authorization", `Bearer ${bob.token}`)
    .expect(200);
  assert.deepEqual(body.state.choices, {});
});
```

If your host has its own routes, test through those instead of calling `admit`.

For socket updates, start the server with `port: 0` and connect with `socket.io-client`, as [socket.test.ts](../../packages/remote-state/__test__/integration/socket.test.ts) does. A full game through a lobby is in [tic-tac-toe.e2e.test.ts](../../packages/remote-state-example-server/__test__/e2e/tic-tac-toe.e2e.test.ts).
