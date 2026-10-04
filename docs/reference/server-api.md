# Server API

Exports of `@malte.muth/remote-state`.

## createRemoteStateServer

```ts
createRemoteStateServer<StateType, ActionType, ViewType>(
  plugin: GamePlugin<StateType, ActionType, ViewType>,
  options?: RemoteStateServerOptions,
): Promise<RemoteStateServer<StateType>>
```

A standalone server for one game. It opens the database, creates an Express app with the [HTTP API](http-api.md) and an HTTP server for it, and attaches Socket.IO unless `socket` is `false`. It doesn't start listening; call `startServer()` for that.

To serve a game from an Express app and HTTP server you already have, use [`createRemoteState`](#createremotestate) instead.

Rejects with `Error("Failed to initialize database", { cause })` if the database can't be opened.

## RemoteStateServer

```ts
interface RemoteStateServer<StateType> {
  app: Express;
  server: http.Server;
  readonly port: number;
  router: Router;
  createGame: (initialState: StateType) => Promise<string>;
  admit: (admission: Admission) => Promise<string>;
  startServer: () => Promise<number>;
  close: () => Promise<void>;
}
```

| Member                        | Description                                                                                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `app`                         | The Express app, with `router` mounted at the root. This is where a host adds its own routes, outside `/api`.                                          |
| `server`                      | The HTTP server                                                                                                                                        |
| `port`                        | The port listened on once started, also when `0` was requested. Before that, the requested port.                                                       |
| `router`                      | The library's routes, as in [`RemoteState`](#remotestate)                                                                                              |
| `createGame(initialState)`    | Stores a new game with `initialState` as sequence 0, and resolves to the game's ID. The game has no players. Rejects if `initialState` is `undefined`. |
| `admit({ gameId, identity })` | Resolves to a single-use admission code for `identity` in the game. See below.                                                                         |
| `startServer()`               | Starts listening on the requested port, and resolves to the actual port. Rejects if it can't listen, for example because the port is in use.           |
| `close()`                     | Disconnects socket clients, closes the database, and stops the HTTP server, closing its open connections                                               |

`app` has no JSON body parser or error handler for the host's routes; the library's apply only to `/api`. Add `express.json()` to routes that read a JSON body.

`createGame` and `admit` are called by the host in the same process ([0021](../explanation/decisions/0021-games-created-with-creategame.md), [0023](../explanation/decisions/0023-no-server-to-server-admit.md)). See [Create games and admit players](../how-to/admit-players.md).

The library never exits the process and doesn't register signal handlers. To shut down on Ctrl-C, add them yourself:

```ts
process.on("SIGINT", async () => {
  await server.close();
  process.exit(0);
});
```

### admit

```ts
interface Admission {
  gameId: string;
  identity: Identity;
}

interface Identity {
  id: string; // chosen by the host; identifies the person within the game
  [detail: string]: unknown; // passed to the game's onJoin as `details`
}

const CODE_LIFETIME_MS = 60_000;
```

The code is 64 hex characters, and can be exchanged once at [`POST /api/tokens`](http-api.md#post-apitokens) within `CODE_LIFETIME_MS` ([0020](../explanation/decisions/0020-hosts-admit-players-through-codes.md)). Only its hash is stored.

Each `identity.id` maps to at most one player per game. The first code redeemed for an identity creates its player through [`onJoin`](game-plugin.md#onjoin). Codes redeemed later for the same identity return the same player with a new token, and their details are ignored ([0019](../explanation/decisions/0019-several-tokens-per-player.md)).

| Rejects with       | When                                             |
| ------------------ | ------------------------------------------------ |
| `UnknownGameError` | No game has this `gameId`                        |
| `Error`            | `identity.id` is missing, not a string, or empty |

### UnknownGameError

```ts
class UnknownGameError extends Error {} // name "UnknownGameError", message "Game <gameId> not found"
```

Thrown by `admit`, so that hosts can tell an unknown game apart from other errors, for example to answer 404.

## createRemoteState

```ts
createRemoteState<StateType, ActionType, ViewType>(
  plugin: GamePlugin<StateType, ActionType, ViewType>,
  options?: RemoteStateOptions,
): Promise<RemoteState<StateType>>
```

The embeddable core for one game, for a host that has its own Express app and HTTP server. It opens the database and creates the router. It doesn't create a server, listen on a port or attach a socket ([0037](../explanation/decisions/0037-embeddable-core-and-server-options.md)). See [Embed in an existing app](../how-to/embed-in-an-existing-app.md).

Rejects with `Error("Failed to initialize database", { cause })` if the database can't be opened.

## RemoteState

```ts
interface RemoteState<StateType> {
  router: Router;
  attach: (httpServer: http.Server) => void;
  createGame: (initialState: StateType) => Promise<string>;
  admit: (admission: Admission) => Promise<string>;
  close: () => Promise<void>;
}
```

| Member                        | Description                                                                                                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `router`                      | An Express router with the [HTTP API](http-api.md) (`/api/…`) and `/health`. Mount it in the host's app, at the root or under a prefix.                       |
| `attach(httpServer)`          | Serves the socket on the host's HTTP server, at the socket path. Until it's called, no updates are pushed. Throws if called twice, or if `socket` is `false`. |
| `createGame(initialState)`    | As in [`RemoteStateServer`](#remotestateserver)                                                                                                               |
| `admit({ gameId, identity })` | As in [`RemoteStateServer`](#remotestateserver)                                                                                                               |
| `close()`                     | Disconnects socket clients, stops accepting new ones, and closes the database. The host's HTTP server keeps running.                                          |

The router's JSON body parser, CORS and error handler apply only to its `/api` routes. Routes the host adds need their own.

Under a prefix, every path in the [HTTP API](http-api.md) gets that prefix, for example `/tic-tac-toe/api/tokens`. The socket path doesn't follow the prefix; set it with the `socket` option.

The socket leaves upgrade requests for other paths alone, so several instances, or the host's own WebSockets, can share one HTTP server ([0038](../explanation/decisions/0038-several-games-by-mounting-several-instances.md)).

## Options

`createRemoteState` takes `RemoteStateOptions`. `createRemoteStateServer` takes `RemoteStateServerOptions`, which adds `port`. These are deployment settings, separate from the game, so the same game can be deployed in different ways ([0037](../explanation/decisions/0037-embeddable-core-and-server-options.md)).

| Option     | Type                           | Default           | Description                                                                                                                                    |
| ---------- | ------------------------------ | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `database` | `string`                       | `":memory:"`      | SQLite file to keep games in, relative to the working directory. Its directory must exist. `:memory:` keeps games only while the process runs. |
| `logger`   | `Logger`                       | `consoleLogger()` | Where the library logs, including MikroORM's output. See [Logging](#logging).                                                                  |
| `cors`     | `CorsOptions`                  | `{ origin: "*" }` | Options of the [`cors`](https://github.com/expressjs/cors#configuration-options) package, applied to the `/api` routes and the socket          |
| `socket`   | `false` or `{ path?: string }` | `{}`              | `false` disables Socket.IO and all push events. `path` is where the socket is served, `/socket.io` by default.                                 |
| `port`     | `number`                       | `3000`            | `RemoteStateServerOptions` only. The port `startServer()` listens on; `0` picks a free one.                                                    |

## Logging

```ts
interface Logger {
  debug: LogFunction;
  info: LogFunction;
  warn: LogFunction;
  error: LogFunction;
}
type LogFunction = (message: string, meta?: unknown) => void;

enum LogLevel { debug = 0, info = 1, warn = 2, error = 3 }

consoleLogger(options?: ConsoleLoggerOptions): Logger
interface ConsoleLoggerOptions {
  level?: LogLevel; // the lowest level printed; default info
  scope?: string; // printed with every message
}

const silentLogger: Logger;
```

Each server logs through its `logger` option. There's no global logger or log level, so servers in one process can log differently. To use your own logger, pass an object with the four methods.

The library logs errors from requests and sockets at `error`, socket connections and the "listening" message at `info`, and everything MikroORM reports, including the migrations it applies, at `debug`.

`consoleLogger` prints messages at `level` and above:

- Output goes to `console.log`, or `console.error` for the `error` level.
- The format is `[ISO timestamp] level scope message | JSON meta`, without the scope if none is set and without the meta if there is none. `Error` objects in `meta` are serialized as `{ name, message, stack }`.

`silentLogger` discards everything, for example in tests.

The library has no endpoint for changing the log level at runtime ([0028](../explanation/decisions/0028-no-operational-endpoints.md)). A host that wants one can add it, and pass a logger whose level it controls.

## Types

Also exported:

- [GamePlugin](game-plugin.md): `GamePlugin`, `ActionValidationResult`, `Awaitable`, `JoiningPlayer`, `StateResult`, `Transition`, `AudienceChanges`, and the values `withAudiences`, `GameRefusal` and `EVERYONE`
- [Socket events](socket-events.md#types): `StateEvent`, `PatchesEvent`, `Patch`, `Format`
- [Options](#options): `RemoteStateOptions`, `RemoteStateServerOptions`
- [Logging](#logging): `Logger`, `LogFunction`, `ConsoleLoggerOptions`
- `Admission`, `Identity`, `CODE_LIFETIME_MS`

## Database schema

SQLite through [MikroORM](https://mikro-orm.io), using the `better-sqlite3` driver. On startup, the server applies any pending migrations. Applied migrations are recorded in the `mikro_orm_migrations` table, so each runs once.

All IDs are UUID strings. Tokens and codes are stored only as SHA-256 hashes ([0017](../explanation/decisions/0017-hashed-tokens-in-header-and-handshake.md)).

**games**

| Column       | Type        |
| ------------ | ----------- |
| `id`         | primary key |
| `created_at` | datetime    |

**players**: everyone admitted to a game, seated or not. Unique per `(game_id, identity_id)`.

| Column             | Type                            | Notes                                                 |
| ------------------ | ------------------------------- | ----------------------------------------------------- |
| `id`               | primary key                     | The `playerId`                                        |
| `game_id`          | foreign key to `games`, indexed |                                                       |
| `identity_id`      | string                          | The host's `identity.id`                              |
| `audience`         | string, nullable                | Set by the game; null for the default audience        |
| `last_activity_at` | datetime, nullable              | Set when the player joins and on each accepted action |
| `created_at`       | datetime                        |                                                       |

**tokens**

| Column       | Type                              | Notes                     |
| ------------ | --------------------------------- | ------------------------- |
| `id`         | primary key                       |                           |
| `player_id`  | foreign key to `players`, indexed | A player may have several |
| `token_hash` | string, unique                    |                           |
| `created_at` | datetime                          |                           |

**admission_codes**

| Column        | Type                            | Notes                         |
| ------------- | ------------------------------- | ----------------------------- |
| `id`          | primary key                     |                               |
| `game_id`     | foreign key to `games`, indexed |                               |
| `code_hash`   | string, unique                  |                               |
| `identity_id` | string                          |                               |
| `details`     | JSON                            | The identity without its `id` |
| `expires_at`  | datetime                        |                               |
| `used_at`     | datetime, nullable              | Set when the code is redeemed |

**game_states**: one row per state; the row with the highest `sequence` is the current state. Unique per `(game_id, sequence)`.

| Column        | Type                               | Notes                                                                                   |
| ------------- | ---------------------------------- | --------------------------------------------------------------------------------------- |
| `id`          | primary key                        |                                                                                         |
| `game_id`     | foreign key to `games`             |                                                                                         |
| `sequence`    | integer                            | 0 for the initial state                                                                 |
| `state`       | JSON                               | Full, unfiltered state                                                                  |
| `full_diff`   | JSON, nullable                     | Immer patches from the previous full state; null for sequence 0. Never sent to clients. |
| `player_id`   | foreign key to `players`, nullable | Who caused this state; null for the initial state                                       |
| `action_type` | string                             | `initial`, `join`, or the action's `type`                                               |
| `action_data` | JSON, nullable                     | The action as the client sent it; null for `initial` and `join`                         |
| `created_at`  | datetime                           |                                                                                         |

**audience_diffs**: what each audience's view changed by, per state. Unique per `(game_id, audience, sequence)`.

| Column     | Type                   | Notes                         |
| ---------- | ---------------------- | ----------------------------- |
| `id`       | primary key            |                               |
| `game_id`  | foreign key to `games` |                               |
| `audience` | string                 |                               |
| `sequence` | integer                | The state the patches lead to |
| `patches`  | JSON                   | Immer patches                 |

**audience_memberships**: the history of each player's audience. A player's audience at a sequence is given by the latest row at or before it.

| Column      | Type                     | Notes                                                               |
| ----------- | ------------------------ | ------------------------------------------------------------------- |
| `id`        | primary key              |                                                                     |
| `player_id` | foreign key to `players` |                                                                     |
| `sequence`  | integer                  | From when this audience applies; the first row is the player's join |
| `audience`  | string, nullable         | As in `players`                                                     |
