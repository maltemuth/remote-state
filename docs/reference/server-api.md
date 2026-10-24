# Server API

Exports of `@malte.muth/remote-state`.

## createRemoteStateServer

```ts
createRemoteStateServer<StateType, ActionType, ViewType>(
  rules: Rules<StateType, ActionType, ViewType>,
  options?: RemoteStateServerOptions,
): Promise<RemoteStateServer<StateType>>
```

A standalone server for one space. It opens the database, creates an Express app with the [HTTP API](http-api.md) and an HTTP server for it, and attaches Socket.IO unless `socket` is `false`. It doesn't start listening; call `startServer()` for that.

To serve a space from an Express app and HTTP server you already have, use [`createRemoteState`](#createremotestate) instead.

Rejects with an [`UnsupportedDatabaseError`](#unsupporteddatabaseerror) for a database from another schema version, and with the database driver's own error if the database can't be opened.

## RemoteStateServer

```ts
interface RemoteStateServer<StateType> {
  app: Express;
  server: http.Server;
  readonly port: number;
  router: Router;
  createSpace: (initialState: StateType) => Promise<string>;
  admit: (admission: Admission) => Promise<string>;
  dispatch: (spaceId: string, action: unknown) => Promise<DispatchResult>;
  startServer: () => Promise<number>;
  close: () => Promise<void>;
}
```

| Member                         | Description                                                                                                                                                                                   |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app`                          | The Express app, with `router` mounted at the root. This is where a host adds its own routes, outside `/api`.                                                                                 |
| `server`                       | The HTTP server                                                                                                                                                                               |
| `port`                         | The port listened on once started, also when `0` was requested. Before that, the requested port.                                                                                              |
| `router`                       | The library's routes, as in [`RemoteState`](#remotestate)                                                                                                                                     |
| `createSpace(initialState)`    | Stores a new space with `initialState` as sequence 0, and resolves to the space's ID. The space has no members. Rejects if `initialState` is `undefined`.                                     |
| `admit({ spaceId, identity })` | Resolves to a single-use admission code for `identity` in the space. See below.                                                                                                               |
| `dispatch(spaceId, action)`    | Runs `action` in the space as the system. See below.                                                                                                                                          |
| `startServer()`                | Starts listening on the requested port, and resolves to the actual port. Rejects if it can't listen, for example because the port is in use.                                                  |
| `close()`                      | Drops pending timers, closes socket clients' connections, closes the database, and stops the HTTP server, closing its open connections. Clients reconnect by themselves once a server is back |

`app` has no JSON body parser or error handler for the host's routes; the library's apply only to `/api`. Add `express.json()` to routes that read a JSON body.

`createSpace`, `admit` and `dispatch` are called by the host in the same process ([0021](../explanation/decisions/0021-games-created-with-creategame.md), [0023](../explanation/decisions/0023-no-server-to-server-admit.md)). See [Create spaces and admit members](../how-to/admit-members.md).

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
  spaceId: string;
  identity: Identity;
}

interface Identity {
  id: string; // chosen by the host; identifies the person within the space
  [detail: string]: unknown; // passed to the space's onJoin as `details`
}

const CODE_LIFETIME_MS = 60_000;
```

The code is 64 hex characters, and can be exchanged once at [`POST /api/tokens`](http-api.md#post-apitokens) within `CODE_LIFETIME_MS` ([0020](../explanation/decisions/0020-hosts-admit-players-through-codes.md)). Only its hash is stored. Each call also deletes the codes that can't be redeemed anymore, because they're used or expired.

Each `identity.id` maps to at most one member per space. The first code redeemed for an identity creates its member through [`onJoin`](rules.md#onjoin). Codes redeemed later for the same identity return the same member with a new token, and their details are ignored ([0019](../explanation/decisions/0019-several-tokens-per-player.md)).

| Rejects with        | When                                             |
| ------------------- | ------------------------------------------------ |
| `UnknownSpaceError` | No space has this `spaceId`                      |
| `Error`             | `identity.id` is missing, not a string, or empty |

### dispatch

```ts
type DispatchResult = { sequence: number } | { rejected: string };
```

Runs `action` in the space as the system, with [`SYSTEM`](rules.md#system) as the member ID ([0040](../explanation/decisions/0040-server-initiated-actions.md)). Use it for actions that come from the host rather than a member, such as a computer player's moves, a deadline or events from outside the space. A host can't act as one of the space's members.

The action runs like a member's: under the space's lock, through [`validateAction`](rules.md#validateaction) and [`executeAction`](rules.md#executeaction), and, if accepted, recorded with the next `sequence` and sent to connected clients. Timers it returns are applied as for any action.

| Resolves to            | When                                                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `{ sequence }`         | The action was accepted; `sequence` is the state it produced                                                        |
| `{ rejected: reason }` | `validateAction` returned `reason`, or `executeAction` threw a `Refusal` with it as its message. Nothing is stored. |

| Rejects with        | When                                                                                      |
| ------------------- | ----------------------------------------------------------------------------------------- |
| `UnknownSpaceError` | No space has this `spaceId`                                                               |
| any other error     | The rules threw another error, or the transition couldn't be recorded. Nothing is stored. |

See [Schedule actions and time limits](../how-to/schedule-actions.md#dispatch-from-the-host).

### UnknownSpaceError

```ts
class UnknownSpaceError extends Error {} // name "UnknownSpaceError", message "Space <spaceId> not found"
```

Thrown by `admit` and `dispatch`, so that hosts can tell an unknown space apart from other errors, for example to answer 404.

### UnsupportedDatabaseError

```ts
class UnsupportedDatabaseError extends Error {} // name "UnsupportedDatabaseError"
```

Thrown by `createRemoteStateServer` and `createRemoteState` when the `database` file was created by a version of the library with another schema. Databases aren't upgraded before 1.0; delete the file, or use the version that created it. See [Persist spaces across restarts](../how-to/persist-spaces.md#after-upgrading-the-library).

## createRemoteState

```ts
createRemoteState<StateType, ActionType, ViewType>(
  rules: Rules<StateType, ActionType, ViewType>,
  options?: RemoteStateOptions,
): Promise<RemoteState<StateType>>
```

The embeddable core for one space, for a host that has its own Express app and HTTP server. It opens the database and creates the router. It doesn't create a server, listen on a port or attach a socket ([0037](../explanation/decisions/0037-embeddable-core-and-server-options.md)). See [Embed in an existing app](../how-to/embed-in-an-existing-app.md).

Rejects with an [`UnsupportedDatabaseError`](#unsupporteddatabaseerror) for a database from another schema version, and with the database driver's own error if the database can't be opened.

## RemoteState

```ts
interface RemoteState<StateType> {
  router: Router;
  attach: (httpServer: http.Server) => void;
  createSpace: (initialState: StateType) => Promise<string>;
  admit: (admission: Admission) => Promise<string>;
  dispatch: (spaceId: string, action: unknown) => Promise<DispatchResult>;
  close: () => Promise<void>;
}
```

| Member                         | Description                                                                                                                                                                                                                         |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `router`                       | An Express router with the [HTTP API](http-api.md) (`/api/…`), including `/api/health`. Mount it in the host's app, at the root or under a prefix.                                                                                  |
| `attach(httpServer)`           | Serves the socket on the host's HTTP server, at the socket path. Until it's called, no updates are pushed. Throws if called twice, or if `socket` is `false`.                                                                       |
| `createSpace(initialState)`    | As in [`RemoteStateServer`](#remotestateserver)                                                                                                                                                                                     |
| `admit({ spaceId, identity })` | As in [`RemoteStateServer`](#remotestateserver)                                                                                                                                                                                     |
| `dispatch(spaceId, action)`    | As in [`RemoteStateServer`](#dispatch)                                                                                                                                                                                              |
| `close()`                      | Drops pending timers, closes socket clients' connections, stops accepting new ones, and closes the database. The host's HTTP server keeps running. Clients keep trying to reconnect, until a server handles the socket's path again |

The router's JSON body parser, CORS and error handler apply only to its `/api` routes. Routes the host adds need their own.

Under a prefix, every path in the [HTTP API](http-api.md) gets that prefix, for example `/tic-tac-toe/api/tokens`. The socket path doesn't follow the prefix; set it with the `socket` option.

The socket leaves upgrade requests for other paths alone, so several instances, or the host's own WebSockets, can share one HTTP server ([0038](../explanation/decisions/0038-several-games-by-mounting-several-instances.md)). The standalone server answers upgrade requests that nothing handles with 404; once the host adds an `upgrade` listener to `server`, it leaves them to the host.

## Options

`createRemoteState` takes `RemoteStateOptions`. `createRemoteStateServer` takes `RemoteStateServerOptions`, which adds `port`. These are deployment settings, separate from the rules, so the same rules can be deployed in different ways ([0037](../explanation/decisions/0037-embeddable-core-and-server-options.md)).

| Option          | Type                          | Default           | Description                                                                                                                                                                                                                                                                                                    |
| --------------- | ----------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `database`      | `string`                      | `":memory:"`      | SQLite file to keep spaces in, relative to the working directory. Its directory must exist. `:memory:` keeps spaces only while the process runs.                                                                                                                                                               |
| `logger`        | `Logger`                      | `consoleLogger()` | Where the library logs, including MikroORM's output. See [Logging](#logging).                                                                                                                                                                                                                                  |
| `cors`          | `CorsOptions`                 | `{ origin: "*" }` | Options of the [`cors`](https://github.com/expressjs/cors#configuration-options) package, applied to the `/api` routes and the socket                                                                                                                                                                          |
| `socket`        | `false` or `SocketSettings`   | `{}`              | `false` disables Socket.IO and all push events. See [Socket settings](#socket-settings).                                                                                                                                                                                                                       |
| `checksums`     | `boolean`                     | `true`            | Send the [checksum](socket-events.md#checksums) of the view with every patch, on the socket and from `GET …/updates`, so clients can check theirs; `false` turns them off ([0059](../explanation/decisions/0059-checksums-with-patches.md), [0061](../explanation/decisions/0061-checksums-on-by-default.md)). |
| `devicePairing` | `boolean`                     | `false`           | Let members pair their own devices: [`POST /api/spaces/:spaceId/codes`](http-api.md#post-apispacesspaceidcodes) gives a member a single-use code for themselves, for another device to redeem ([0063](../explanation/decisions/0063-players-pair-their-own-devices.md)).                                       |
| `diff`          | `"positional"` or `"rfc6902"` | `"positional"`    | How patches between views are computed: the library's own diff, or `rfc6902`'s, the established reference it's tested against ([0058](../explanation/decisions/0058-rfc6902-kept-as-reference-and-option.md)). Both give patches that lead to the same views.                                                  |
| `port`          | `number`                      | `3000`            | `RemoteStateServerOptions` only. The port `startServer()` listens on; `0` picks a free one.                                                                                                                                                                                                                    |

### Socket settings

| Setting             | Type                                    | Default      | Description                                                                                                                                                                                |
| ------------------- | --------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `path`              | `string`                                | `/socket.io` | Where the socket is served                                                                                                                                                                 |
| `parser`            | a Socket.IO parser                      | JSON         | Encodes events, for example `socket.io-msgpack-parser` for MessagePack. Clients must use the same parser ([0060](../explanation/decisions/0060-socket-parser-and-compression-options.md)). |
| `perMessageDeflate` | `boolean` or permessage-deflate options | `false`      | Compresses messages; `threshold` is the smallest message compressed, 1024 bytes by default. Clients negotiate it by themselves.                                                            |

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

The library logs:

- at `error`: errors from requests, sockets and due timers
- at `info`: socket connections, the "listening" message, timer actions the space rejected, and every recorded state ([0039](../explanation/decisions/0039-actions-recorded-with-authors-audience.md))
- at `debug`: everything MikroORM reports, and creating the schema in a new database

A recorded state is logged once its transaction has committed, as `<actionType> by <author> in space <spaceId>, now at <sequence>`. The author is `<audience>:<memberId>`, with the member's audience when they acted or the audience they joined into, for example `place by everyone:4f1c… in space 9a2e…, now at 5`, or `system` for actions of the system.

`consoleLogger` prints messages at `level` and above:

- Output goes to `console.log`, or `console.error` for the `error` level.
- The format is `[ISO timestamp] level scope message | JSON meta`, without the scope if none is set and without the meta if there is none. `Error` objects in `meta` are serialized as `{ name, message, stack }`.

`silentLogger` discards everything, for example in tests.

The library has no endpoint for changing the log level at runtime ([0049](../explanation/decisions/0049-health-check-under-the-api.md)). A host that wants one can add it, and pass a logger whose level it controls.

## Types

Also exported:

- [Rules](rules.md): `Rules`, `ActionValidationResult`, `Awaitable`, `JoiningMember`, `StateResult`, `Transition`, `TransitionChanges`, `TimerRequest`, `AudienceChanges`, and the values `transition`, `withAudiences`, `Refusal`, `SYSTEM` and `EVERYONE`
- [Socket events](socket-events.md#types): `StateEvent`, `PatchesEvent`, `Patch`, `Format`
- [Options](#options): `RemoteStateOptions`, `RemoteStateServerOptions`
- [Logging](#logging): `Logger`, `LogFunction`, `ConsoleLoggerOptions`
- `Admission`, `Identity`, `CODE_LIFETIME_MS`, `DispatchResult`
- Errors: `UnknownSpaceError`, `UnsupportedDatabaseError`

## Database schema

SQLite through [MikroORM](https://mikro-orm.io), using the `better-sqlite3` driver. A new database gets the tables below, and the schema's version as SQLite's `user_version`. A database with another version, or with tables but no version, is refused with an `UnsupportedDatabaseError`: databases aren't upgraded before 1.0 ([0048](../explanation/decisions/0048-no-database-upgrades-before-1-0.md)).

All IDs are UUID strings. Tokens and codes are stored only as SHA-256 hashes ([0017](../explanation/decisions/0017-hashed-tokens-in-header-and-handshake.md)).

**spaces**

| Column       | Type        |
| ------------ | ----------- |
| `id`         | primary key |
| `created_at` | datetime    |

**members**: everyone admitted to a space, seated or not. Unique per `(space_id, identity_id)`.

| Column        | Type                             | Notes                                           |
| ------------- | -------------------------------- | ----------------------------------------------- |
| `id`          | primary key                      | The `memberId`                                  |
| `space_id`    | foreign key to `spaces`, indexed |                                                 |
| `identity_id` | string                           | The host's `identity.id`                        |
| `audience`    | string, nullable                 | Set by the rules; null for the default audience |
| `created_at`  | datetime                         |                                                 |

**tokens**

| Column       | Type                              | Notes                     |
| ------------ | --------------------------------- | ------------------------- |
| `id`         | primary key                       |                           |
| `member_id`  | foreign key to `members`, indexed | A member may have several |
| `token_hash` | string, unique                    |                           |
| `created_at` | datetime                          |                           |

**admission_codes**: rows are deleted once used or expired, the next time `admit` is called.

| Column        | Type                             | Notes                         |
| ------------- | -------------------------------- | ----------------------------- |
| `id`          | primary key                      |                               |
| `space_id`    | foreign key to `spaces`, indexed |                               |
| `code_hash`   | string, unique                   |                               |
| `identity_id` | string                           |                               |
| `details`     | JSON                             | The identity without its `id` |
| `expires_at`  | datetime                         |                               |
| `used_at`     | datetime, nullable               | Set when the code is redeemed |

**space_states**: one row per state; the row with the highest `sequence` is the current state. Unique per `(space_id, sequence)`.

| Column        | Type                               | Notes                                                                                                                                                                                                                             |
| ------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`          | primary key                        |                                                                                                                                                                                                                                   |
| `space_id`    | foreign key to `spaces`            |                                                                                                                                                                                                                                   |
| `sequence`    | integer                            | 0 for the initial state                                                                                                                                                                                                           |
| `state`       | JSON                               | Full, unfiltered state                                                                                                                                                                                                            |
| `member_id`   | foreign key to `members`, nullable | Who caused this state; null for the initial state and actions of the system                                                                                                                                                       |
| `audience`    | string, nullable                   | The author's audience when they acted, or the audience they joined into, including a default audience such as `everyone`; null without a member ([0039](../explanation/decisions/0039-actions-recorded-with-authors-audience.md)) |
| `action_type` | string                             | `initial`, `join`, or the action's `type`                                                                                                                                                                                         |
| `action_data` | JSON, nullable                     | The action as sent by the client or the system; null for `initial` and `join`                                                                                                                                                     |
| `created_at`  | datetime                           |                                                                                                                                                                                                                                   |

**audience_memberships**: the history of each member's audience. A member's audience at a sequence is given by the latest row at or before it.

| Column      | Type                     | Notes                                                               |
| ----------- | ------------------------ | ------------------------------------------------------------------- |
| `id`        | primary key              |                                                                     |
| `member_id` | foreign key to `members` |                                                                     |
| `sequence`  | integer                  | From when this audience applies; the first row is the member's join |
| `audience`  | string, nullable         | As in `members`                                                     |
