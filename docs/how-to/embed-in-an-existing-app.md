# Embed in an existing app

`createRemoteStateServer` creates its own Express app and HTTP server. If your app already has both, use `createRemoteState` instead. It returns the library's routes as a router and a socket to attach, and leaves listening and shutting down to you ([0037](../explanation/decisions/0037-embeddable-core-and-server-options.md)).

## Mount the router and attach the socket

```ts
import express from "express";
import { createServer } from "http";
import { createRemoteState } from "@malte.muth/remote-state";

const app = express();
const httpServer = createServer(app);

const remote = await createRemoteState(myGame, {
  database: "my-game.db",
  socket: { path: "/my-game/socket.io" },
});
app.use("/my-game", remote.router);
remote.attach(httpServer);

httpServer.listen(3000);
```

The prefix is up to you. With `/my-game`, the [HTTP API](../reference/http-api.md) is at `/my-game/api/…` and the health check at `/my-game/health`. To serve the API at `/api`, mount the router without a prefix: `app.use(remote.router)`.

The socket path doesn't follow the router's prefix, so set it with the `socket` option. Without it, the socket is at `/socket.io`. Call `attach` once. Until you do, the API works but no updates are pushed.

A browser client then loads the Socket.IO client from the socket path and connects with it:

```html
<script src="/my-game/socket.io/socket.io.js"></script>
```

```js
const socket = io({ path: "/my-game/socket.io", auth: { gameId, token } });
```

The socket only handles requests to its own path, so it can share the HTTP server with your own WebSockets.

## Add your own routes

Your app needs routes that create games and admit players; see [Create games and admit players](admit-players.md). Call `createGame` and `admit` on what `createRemoteState` returned:

```ts
app.post("/my-game/lobby/games", express.json(), async (req, res) => {
  const gameId = await remote.createGame(newGame());
  res.status(201).json({ gameId });
});
```

The router's JSON body parser, CORS and error handler apply only to its own `/api` routes. Add `express.json()` to your routes that read a JSON body, and your own error handler if their errors should be JSON.

## Allow other origins

By default, the library's API and socket accept requests from any origin. To limit them, pass the [`cors`](https://github.com/expressjs/cors#configuration-options) package's options:

```ts
const remote = await createRemoteState(myGame, {
  cors: { origin: "https://my-app.example.com" },
});
```

The option applies to the routes under `/api` and to the socket. Your own routes need their own CORS.

## Log with your app's logger

The library logs to the console at `info` and above by default. To log through your app's logger, pass an object with `debug`, `info`, `warn` and `error` methods:

```ts
import { type Logger } from "@malte.muth/remote-state";

const logger: Logger = {
  debug: (message, meta) => appLogger.debug({ meta }, message),
  info: (message, meta) => appLogger.info({ meta }, message),
  warn: (message, meta) => appLogger.warn({ meta }, message),
  error: (message, meta) => appLogger.error({ meta }, message),
};

const remote = await createRemoteState(myGame, { logger });
```

`appLogger` stands for your app's logger. The library passes errors as `meta`. Everything MikroORM reports arrives at `debug`.

To keep the console output but change its level or label it, pass `consoleLogger({ level: LogLevel.warn, scope: "my-game" })`. See [Logging](../reference/server-api.md#logging).

## Shut down

`close()` disconnects the game's socket clients and closes its database. It doesn't stop your HTTP server, which may serve other things, and it doesn't exit the process:

```ts
process.on("SIGTERM", async () => {
  await remote.close();
  httpServer.close(() => process.exit(0));
});
```

Close the library when you stop serving requests. After `close()`, its routes fail, because the database is closed.

## Host several games on one server

Create one instance per game, each with its own prefix, socket path and database file ([0038](../explanation/decisions/0038-several-games-by-mounting-several-instances.md)):

```ts
import { type GamePlugin } from "@malte.muth/remote-state";

const mountGame = async <StateType, ActionType, ViewType>(
  prefix: string,
  plugin: GamePlugin<StateType, ActionType, ViewType>,
) => {
  const remote = await createRemoteState(plugin, {
    database: `${prefix.slice(1)}.db`,
    socket: { path: `${prefix}/socket.io` },
  });
  app.use(prefix, remote.router);
  remote.attach(httpServer);
  return remote;
};

const ticTacToe = await mountGame("/tic-tac-toe", ticTacToePlugin);
const battleship = await mountGame("/battleship", battleshipPlugin);
```

Each of them needs its own:

- **Prefix,** because every instance serves the same paths, such as `/api/tokens`.
- **Socket path,** because each instance answers only on its own path, and leaves the others' requests alone.
- **Database file,** because the database doesn't record which game a stored game belongs to.

A client uses the prefix and socket path of the game it plays. To shut down, close every instance, then the HTTP server:

```ts
await Promise.all([ticTacToe.close(), battleship.close()]);
```

The example server works this way. [mountGame.ts](../../packages/remote-state-example-server/src/host/mountGame.ts) mounts one game together with its lobby, and [servers.ts](../../packages/remote-state-example-server/src/host/servers.ts) serves tic-tac-toe and battleship side by side, with the tic-tac-toe browser client.
