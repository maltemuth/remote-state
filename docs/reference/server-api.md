# Server API

Exports of `@malte.muth/remote-state`.

## createRemoteStateServer

```ts
createRemoteStateServer<StateType, ActionType, PlayerStateType>(
  plugin: GamePlugin<StateType, ActionType, PlayerStateType>,
  port?: number // default 3000; 0 picks a free port
): Promise<RemoteStateServer<StateType, ActionType, PlayerStateType>>
```

Initializes the database, creates the Express app with all [HTTP routes](http-api.md), and attaches Socket.IO. It doesn't start listening; call `startServer()` for that.

If `serverConfiguration.minimumLogLevel` is set, it's applied as the global log level for the whole process.

Rejects with `Error("Failed to initialize database", { cause })` if the database can't be opened.

## RemoteStateServer

| Member | Type | Description |
|---|---|---|
| `app` | `Express` | The Express app. Routes added outside `/api` are reachable. |
| `server` | `http.Server` | The HTTP server. After `startServer()`, `server.address().port` is the actual port. |
| `socketIOManager` | `SocketManager \| null` | `null` when Socket.IO is disabled |
| `startServer()` | `() => Promise<void>` | Starts listening on `port` |
| `shutdown(andExit = true)` | `(andExit?: boolean) => Promise<void>` | Closes Socket.IO, the HTTP server and the database. Unless `andExit` is `false`, it then calls `process.exit` (code 0, or 1 if shutdown failed). |
| `port` | `number` | The port passed in |

The library doesn't register signal handlers. To shut down on Ctrl-C, add them yourself:

```ts
process.on("SIGINT", () => server.shutdown());
```

## RemoteStateServerConfiguration

Set as `plugin.serverConfiguration`.

| Field | Type | Default | Description |
|---|---|---|---|
| `minimumLogLevel` | `LogLevel` | global level (`debug`) | Sets the process-wide log level |
| `persistDatabase` | `boolean` | `false` | Store games in a SQLite file instead of memory |
| `databaseFilename` | `string` | `games.db` | File path, relative to the working directory. Only used with `persistDatabase`. |
| `socketIO.enabled` | `boolean` | `true` | `false` disables Socket.IO and all push events |
| `socketIO.cors` | `{ origin, methods }` | `{ origin: "*", methods: ["GET", "POST"] }` | Socket.IO CORS settings |

## SocketManager

Available as `server.socketIOManager`.

| Method | Description |
|---|---|
| `broadcastToGame(gameId, event, data)` | Emit to all sockets of a game |
| `sendToPlayer(playerId, event, data)` | Emit to all sockets of one player |
| `broadcastGameStateUpdate({ gameId, stateId, sequence }, stateForPlayer)` | Emit `game-state-update` to each connected player, with `state` set to `await stateForPlayer(playerId)`. Used internally after each action. |
| `close()` | Close Socket.IO and the HTTP server |

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

## Types

Also exported: `GamePlugin`, `ActionValidationResult` ([GamePlugin](game-plugin.md)), `RemoteStateServerConfiguration`, `SocketIOServerConfiguration`, `SocketManager`, and `GameStateUpdateEvent` ([Socket events](socket-events.md#game-state-update)).

## Database schema

SQLite, managed by Sequelize. Tables are created on startup if they're missing. Existing tables are never altered, so after a schema change an old database file must be deleted.

**games**

| Column | Type |
|---|---|
| `id` | UUID string, primary key |
| `name` | string |
| `createdAt`, `updatedAt` | datetime |

**players**

| Column | Type | Notes |
|---|---|---|
| `id` | UUID string, primary key | |
| `gameId` | string, indexed | |
| `name` | string | |
| `role` | `admin` or `player` | The game's creator is `admin` |
| `token` | 64 hex characters | |
| `tokenType` | string | Always `secure` |
| `lastActivityAt` | datetime, nullable | Updated on each accepted action |
| `createdAt`, `updatedAt` | datetime | |

**gameStates**: one row per state; the latest row is the current state.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID string, primary key | The `stateId` |
| `gameId` | string | |
| `sequence` | integer | Unique per game; 0 for the initial state |
| `state` | JSON | Full, unfiltered state |
| `playerId` | string | Who caused this state (the creator for sequence 0) |
| `actionType` | string | `initial`, or the action's `type` |
| `actionData` | JSON | The action as the client sent it |
| `createdAt`, `updatedAt` | datetime | |
