# Server API

Exports of `@malte.muth/remote-state`.

## createRemoteStateServer

```ts
createRemoteStateServer<StateType, ActionType, ViewType>(
  plugin: GamePlugin<StateType, ActionType, ViewType>,
  port?: number // default 3000; 0 picks a free port
): Promise<RemoteStateServer<StateType>>
```

Initializes the database, creates the Express app with the [HTTP API](http-api.md), and attaches Socket.IO unless it's disabled. It doesn't start listening; call `startServer()` for that.

If `serverConfiguration.minimumLogLevel` is set, it's applied as the global log level for the whole process.

Rejects with `Error("Failed to initialize database", { cause })` if the database can't be opened.

## RemoteStateServer

```ts
interface RemoteStateServer<StateType> {
  app: Express;
  server: http.Server;
  port: number;
  createGame: (initialState: StateType) => Promise<string>;
  admit: (admission: Admission) => Promise<string>;
  startServer: () => Promise<void>;
  shutdown: (andExit?: boolean) => Promise<void>;
}
```

| Member                        | Description                                                                                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `app`                         | The Express app. Routes added outside `/api` are reachable; this is where a host adds its own.                                                         |
| `server`                      | The HTTP server. After `startServer()`, `server.address().port` is the actual port.                                                                    |
| `port`                        | The port passed in                                                                                                                                     |
| `createGame(initialState)`    | Stores a new game with `initialState` as sequence 0, and resolves to the game's ID. The game has no players. Rejects if `initialState` is `undefined`. |
| `admit({ gameId, identity })` | Resolves to a single-use admission code for `identity` in the game. See below.                                                                         |
| `startServer()`               | Starts listening on `port`                                                                                                                             |
| `shutdown(andExit = true)`    | Closes Socket.IO, the HTTP server and the database. Unless `andExit` is `false`, it then calls `process.exit` (code 0, or 1 if shutdown failed).       |

`createGame` and `admit` are called by the host in the same process ([0021](../explanation/decisions/0021-games-created-with-creategame.md), [0023](../explanation/decisions/0023-no-server-to-server-admit.md)). See [Create games and admit players](../how-to/admit-players.md).

The library doesn't register signal handlers. To shut down on Ctrl-C, add them yourself:

```ts
process.on("SIGINT", () => server.shutdown());
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

## RemoteStateServerConfiguration

Set as `plugin.serverConfiguration`.

| Field              | Type                  | Default                                     | Description                                                                     |
| ------------------ | --------------------- | ------------------------------------------- | ------------------------------------------------------------------------------- |
| `minimumLogLevel`  | `LogLevel`            | global level (`debug`)                      | Sets the process-wide log level                                                 |
| `persistDatabase`  | `boolean`             | `false`                                     | Store games in a SQLite file instead of memory                                  |
| `databaseFilename` | `string`              | `games.db`                                  | File path, relative to the working directory. Only used with `persistDatabase`. |
| `socketIO.enabled` | `boolean`             | `true`                                      | `false` disables Socket.IO and all push events                                  |
| `socketIO.cors`    | `{ origin, methods }` | `{ origin: "*", methods: ["GET", "POST"] }` | Socket.IO CORS settings                                                         |

## Logging

```ts
enum LogLevel { debug = 0, info = 1, warn = 2, error = 3 }

setGlobalLogLevel(level: LogLevel): void
getGlobalLogLevel(): LogLevel
createLogger(options?: { scope?: string; logLevel?: LogLevel }): Logger
// Logger: { debug, info, warn, error }, each (message: string, meta?: unknown) => void
```

- Loggers without a `logLevel` follow the global level, including changes made after they were created.
- Output goes to `console.log`, or `console.error` for the `error` level.
- The format is `[ISO timestamp] level scope message | JSON meta`, with `Error` objects in `meta` serialized as `{ name, message, stack }`.

The package also exports ready-made `debug`, `info`, `warn` and `error` functions without a scope.

The library has no endpoint for changing the log level at runtime ([0028](../explanation/decisions/0028-no-operational-endpoints.md)). A host that wants one can add it and call `setGlobalLogLevel`.

## Types

Also exported:

- [GamePlugin](game-plugin.md): `GamePlugin`, `ActionValidationResult`, `Awaitable`, `JoiningPlayer`, `StateResult`, `Transition`, `AudienceChanges`, and the values `withAudiences`, `GameRefusal` and `EVERYONE`
- [Socket events](socket-events.md#types): `StateEvent`, `PatchesEvent`, `Patch`, `Format`
- `RemoteStateServerConfiguration`, `SocketIOServerConfiguration`, `Admission`, `Identity`, `CODE_LIFETIME_MS`

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
