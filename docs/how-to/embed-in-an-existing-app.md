# Embed in an existing app

If your app already has an Express app and HTTP server, use `createRemoteState` instead of `createRemoteStateServer`: it returns a router and a socket to attach ([0037](../explanation/decisions/0037-embeddable-core-and-server-options.md)).

```ts
import express from "express";
import { createServer } from "node:http";
import { createRemoteState } from "@malte.muth/remote-state";

const app = express();
const httpServer = createServer(app);

const remote = await createRemoteState(myRules, {
  database: "my-game.db",
  socket: { path: "/my-game/socket.io" },
});
app.use("/my-game", remote.router); // the API is at /my-game/api/…
remote.attach(httpServer);

httpServer.listen(3000);
```

- **The socket path doesn't follow the prefix.** Set it with `socket.path`, or it's `/socket.io`.
- **Call `attach` once.** Until then, the API works but nothing is pushed.
- **Add your own routes** for creating spaces and admitting members, calling `remote.createSpace` and `remote.admit` ([Create spaces and admit members](admit-members.md)).
- **Your routes need their own** `express.json()`, CORS and error handler; the router's apply only to its `/api`.
- **Logging and CORS** are [options](../reference/server-api.md#options): `logger` takes any object with `debug`, `info`, `warn` and `error`.

## Shut down

`close()` disconnects the spaces' clients and closes its database. It doesn't stop your HTTP server or exit:

```ts
process.on("SIGTERM", async () => {
  await remote.close();
  httpServer.close(() => process.exit(0));
});
```

## Several kinds of space on one server

One instance per set of rules, such as one per game, each with its own prefix, socket path and database file ([0038](../explanation/decisions/0038-several-games-by-mounting-several-instances.md)):

```ts
const mountGame = async (prefix, rules) => {
  const remote = await createRemoteState(rules, {
    database: `${prefix.slice(1)}.db`,
    socket: { path: `${prefix}/socket.io` },
  });
  app.use(prefix, remote.router);
  remote.attach(httpServer);
  return remote;
};

const ticTacToe = await mountGame("/tic-tac-toe", ticTacToeRules);
const battleship = await mountGame("/battleship", battleshipRules);
```

Each instance serves the same paths and answers only on its own socket path, and a database doesn't record which rules it belongs to. The example server works this way: [mountGame.ts](../../packages/remote-state-example-server/src/host/mountGame.ts), [servers.ts](../../packages/remote-state-example-server/src/host/servers.ts).
