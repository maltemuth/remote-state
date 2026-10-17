# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/). Before 1.0, minor versions may contain breaking changes.

## Unreleased

### Added

- `repository`, `homepage` and `bugs` in the library's and the client's `package.json`, pointing to GitHub.

### Fixed

- The standalone server left WebSocket upgrade requests for paths nothing handles open until the client gave up. It answers them with 404 now, unless the host has added an `upgrade` listener of its own. Embedded instances still leave them alone (0038).
- Load test: `--profile` wrote no profile on Windows, where the signal that stopped the server ended it at once. The server is now asked to stop over IPC.

## 0.9.0 - 2026-10-17

Databases from 0.8.0 have to be deleted: the schema's version is now 2.

### Added

- `GamePlugin.onRestart`, called for every stored game when the library starts on a database that already has games. Timers are lost on a restart, so a game with timers pauses itself there and waits to be resumed, or schedules its timers again. Returning the state unchanged records nothing (0052).
- Example: a tic-tac-toe game whose turn timer was running is paused by a restart, and nobody can move until it's resumed, with the turn's full time. The lobby resumes it at `POST /tic-tac-toe/lobby/games/:gameId/resume`, and the page shows a Resume button while it's paused.

### Removed

- `GamePlugin.gameConfig`. Its `name` only labelled the health check, and `description` was never read.
- The `full_diff` column of game states and the diff computed for it on every action. Full states remain stored; diffs between them can be computed when needed (0050, superseding 0013).
- The `last_activity_at` column of players, which was written on every action and never read.
- Client: the `fetch` option of `createClient` and `redeemCode`. Both use the global `fetch`.

### Changed

- `createRemoteState` and `createRemoteStateServer` reject with the database driver's own error when the database can't be opened, instead of wrapping it in `Error("Failed to initialize database")`.
- `GET /health` moved to `GET /api/health`, so everything the router serves is under `/api` (0049, superseding 0028). It answers 200 with an empty body. CORS applies to `/api` only.
- Example: battleship follows the classic rules, a 10×10 board with a carrier (5), a battleship (4), a cruiser (3), a submarine (3) and a destroyer (2) per player. Players are seated on admission only; `join` and `leave` are no longer actions. Its engine validates with `true | string` and applies actions with Immer, and the unused timestamps, action `playerId` and validation codes are gone.
- Load test: games follow the classic rules, 43 actions each instead of 17, so results can't be compared with earlier ones. The scripted game lives in `src/games/battleship/script.ts`.
- Tests run on Node's test runner, loaded through tsx, instead of Jest and `ts-jest`, which brought in `sprintf-js` and its unfixed advisory (0051, superseding 0004 for tests). `npm audit` reports 0 findings again, and the tests need no Node flag.

### Fixed

- A transition with a change passed as `undefined`, such as `transition(state, { schedule: undefined })`, failed the action with status 500; missing and undefined changes now both default to none.
- Client: a whole view that arrived while a catch-up failed was dropped, leaving the view stale until the next change.
- Client: `waitFor` never settled after `close()` or a refused connection; it now rejects. After `close()`, subscribers aren't called anymore.
- Example: battleship accepted ship types inherited from `Object.prototype`, such as `toString`, which made a fleet unsinkable, and failed with status 500 on fractional positions and on actions that aren't objects; all are rejected now. The tic-tac-toe page shows its connection state from the start.

## 0.8.0 - 2026-10-04

Databases from earlier versions have to be deleted (decision 0048).

### Added

- `UnsupportedDatabaseError`, thrown by `createRemoteState` and `createRemoteStateServer` for a database created by another version of the library.

### Removed

- Database migrations, and the dependency on `@mikro-orm/migrations`. Databases aren't upgraded before 1.0: a new database gets the schema generated from the entities, with its version in SQLite's `user_version`, and a database from another version is refused.

### Fixed

- Clients reconnect after the server is closed and restarted. `close()` used to end their sockets with a Socket.IO disconnect, which clients don't retry; it now closes the connections underneath, which they do.

### Changed

- States and views drop keys named `__proto__` and `constructor` at any depth, so clients can apply every patch with Immer. A stored state that had them is logged as a warning (decision 0047).

## 0.7.0 - 2026-10-04

The client package (decisions 0043–0045).

### Added

- `@malte.muth/remote-state-client`, a client for browsers and Node.js. `redeemCode` exchanges an admission code for a session. `createClient` keeps the player's view in step with the server: it receives Immer patches by default, applies them, ignores stale updates, and catches up through `GET …/updates` after gaps or patches that don't apply. Anything can subscribe to the view, which is frozen and keeps unchanged parts as the same objects. `send` sends actions and throws an `ActionRejectedError` with the game's reason. It's generic over the game's view and action types.
- Load test: `--runs` repeats a run against a freshly started server each time, and `--profile` has the server write a CPU profile per run. `npm run perf:profile` summarizes a profile by package and function.

### Changed

- The example's tic-tac-toe browser client uses the client package. The example server serves the package and its dependencies as ES modules under `/modules`, for the page's import map.

## 0.6.0 - 2026-10-04

Server-initiated actions (decisions 0039–0042).

### Added

- Timers: the join hook and `executeAction` can return `transition(state, { audiences, schedule, cancel })`. A scheduled timer has a name, a duration (`in`, in milliseconds) and an action; scheduling a pending name again replaces it, and `cancel` drops timers by name. When a timer is due, its action runs as the system, under the game's lock and through `validateAction` like any other action. Timers are kept in memory only and are lost when the server restarts; how they should behave across restarts is still open (0042).
- `SYSTEM` (`"system"`): the player ID of actions from timers and from the host.
- `act(gameId, action)` on the server: the host runs an action as the system, for example for computer players or outside events. It resolves with `{ sequence }` or `{ rejected }`, and throws `UnknownGameError` for an unknown game.
- Every recorded state is logged at `info` with its author as `<audience>:<playerId>`, or `system`, and stores the author's audience in a new `audience` column of `game_states` (0039). The column is added by a migration.
- How-to guide: Schedule actions and time limits.
- Tic-tac-toe example: an optional time limit per move, `newTicTacToeGame({ turnSeconds })`. When it runs out, the player to move loses. The example host uses 60 seconds.

### Changed

- `withAudiences(state, audiences)` is now a shorthand for `transition(state, { audiences })`.
- System actions are recorded without a player (`game_states.player_id` is null).

## 0.5.0 - 2026-10-04

### Added

- A load test, `npm run perf`: many battleship games at once against the example server in its own process, reporting throughput and latency until the other player receives each update.
- Measured results of the load test, in `docs/reference/performance.md`.

## 0.4.2 - 2026-10-04

### Added

- The library package has a README for its npm page, a `LICENSE` file, keywords, and `publishConfig` for public access.

### Changed

- The library's package contains only `dist/`, `README.md`, `LICENSE` and `package.json`.
- `npm run build` removes `dist/` first, and packing or publishing rebuilds it (`prepack`), so files from older builds can't be published.
- The example package is marked `private`, so it can't be published.

## 0.4.1 - 2026-10-04

### Changed

- `admit` deletes admission codes that are used or expired, so they no longer accumulate.

## 0.4.0 - 2026-10-04

The library becomes embeddable, and deployment settings move out of the game (decisions 0037, 0038).

### Breaking

- `plugin.serverConfiguration` is gone. Settings are options: `createRemoteStateServer(plugin, { port, database, logger, cors, socket })`. `database` is a SQLite path (`:memory:` by default) and replaces `persistDatabase` and `databaseFilename`; `cors` applies to the HTTP API and the socket; `socket: false` disables the socket, and `socket.path` sets its path.
- `shutdown(andExit)` is replaced by `close()`, which never exits the process.
- `startServer()` resolves with the port, and `port` reports the port actually listened on, also when 0 was requested.
- Logging has no global state anymore. `createLogger`, `setGlobalLogLevel`, `getGlobalLogLevel`, the top-level `debug`/`info`/`warn`/`error` functions and `minimumLogLevel` are removed. Pass a `Logger` as the `logger` option; `consoleLogger({ level, scope })` and `silentLogger` are provided.
- The standalone server's app no longer parses JSON for routes the host adds; add `express.json()` to them.
- Example: one host serves both games, tic-tac-toe under `/tic-tac-toe` and battleship under `/battleship`, each with its lobby, socket path and database file (`tic-tac-toe.db`, `battleship.db`). `createTicTacToeServer`, `createBattleshipServer` and `addLobby` are replaced by `createExampleServer`, `mountGame` and `createLobby`.

### Added

- `createRemoteState(plugin, options)`: the embeddable core, with a `router` to mount in the host's Express app, `attach(httpServer)` for the socket, `createGame`, `admit` and `close()`. Closing it leaves the host's HTTP server running.
- MikroORM's output, including the migrator's, goes to the server's logger at debug level instead of the console.

### Changed

- Sockets no longer destroy upgrade requests for other paths, so several instances and the host's own WebSockets can share one HTTP server.
- The library's JSON parsing and error handler apply to its `/api` routes only, and CORS to `/api` and `/health`.

## 0.3.0 - 2026-10-04

The library is rebuilt around the decisions in `docs/explanation/decisions/` 0015–0036: hosts create games and admit players, views are computed per audience, and clients receive patches.

### Breaking

- New database schema, as a new initial migration. Databases from 0.2.0 or earlier aren't migrated and must be deleted.
- Games are created by the host: `server.createGame(initialState)` returns the game's ID (0021, 0036). `GamePlugin.getInitialState` is gone; the library has no game options.
- People are admitted by the host: `server.admit({ gameId, identity: { id, ...details } })` returns a single-use code, valid for a minute, which the client exchanges at `POST /api/tokens` for `{ gameId, playerId, token }` (0020). Admitting the same identity again returns the same player with a new token; a player can hold several tokens (0019).
- Removed endpoints: `POST /api/games`, `POST /api/games/:gameId/players` and `POST /admin/log-level` (0020, 0028).
- Tokens are only accepted in the `Authorization: Bearer` header and the socket handshake; the `token` body field is gone. Tokens are stored as SHA-256 hashes (0017).
- `POST /api/games/:gameId/actions` answers 201 with `{ sequence }`; the state arrives over the socket (0034).
- `GET /api/games/:gameId/state/:cursor` is replaced by `GET /api/games/:gameId/state`, returning `{ gameId, sequence, state }` (0009).
- Plugin changes:
  - `filterStateForPlayer(state, playerId)` is replaced by `filterStateForAudience(state, audience)` (0024). By default, each player is their own audience, named by their player ID, so existing filters work unchanged; without a filter, everyone shares one audience (0025).
  - The new optional `onJoin(state, { playerId, details })` adds a player to the game's state, or throws `GameRefusal` to refuse them (0026).
  - `executeAction` and `onJoin` may return `withAudiences(state, { [playerId]: audience })` to move players between audiences (0027).
  - Plugin functions may return plain values instead of promises.
- Socket events: `game-state-update`, `player-joined` and `player-left` are replaced by `state` (`{ gameId, sequence, state }`) and `patches` (`{ gameId, sequence, patches }`). Clients choose with the `format` handshake query parameter, `state` (default) or `immer`; other values are refused (0008, 0014). The socket sends the current state on connect (0031).
- Players have no name or role in the library anymore (0022); games keep them in their state.
- `RemoteStateServer` has one type parameter, the state type, and no `socketIOManager`.
- Tic-tac-toe example: rewritten. Players are seated when admitted, actions are `place` and `rematch`, and rematches alternate who starts.
- Battleship example: players are seated when admitted; `join` and `leave` are no longer actions. `newBattleshipGame()` creates the initial state.

### Added

- `GET /api/games/:gameId/updates?since=<sequence>`: one patch, in Immer's format, from the player's view at `since` to their current view (0029, 0030, 0035). It answers 404 for a `since` the player can't have had, and 303 to `…/state` when no patch can be built.
- Each transition stores the full-state diff, every audience's diff, and audience changes (0012, 0013, 0024).
- `UnknownGameError`, thrown by `admit` for an unknown game.
- Example server: lobby endpoints `POST /lobby/games` and `POST /lobby/games/:gameId/codes`, showing how a host without a login creates games and admits people.

### Changed

- States returned by games are normalized to JSON before they're stored and diffed.
- Malformed JSON request bodies are answered with 400 instead of 500.
- ESLint's `no-undef` is off for TypeScript files, which TypeScript checks itself.
- The library's and example's source is split into small files, each starting with a comment explaining its purpose.

## 0.2.0 - 2026-10-04

### Breaking

- Battleship example: players claim a seat with a `join` action, and ships can only be placed during setup, one of each type. There are now two ship types, a destroyer (3) and a battleship (4). `validateActionSimple` and `executeActionSimple` were removed.
- Node.js 24 or newer is required (`engines`), and `.nvmrc` pins v24.21.0.
- The example server's `dev` script was removed; it never worked under ESM. Use `npm run start:example`.
- The library is now an ES module (`"type": "module"`), with an `exports` map. On Node 24, CommonJS code can still load it with `require()`.
- The data layer moved from Sequelize to MikroORM 7, with a new schema. Database files created by 0.1.0 or earlier can't be migrated and must be deleted. Schema changes:
  - column names are `snake_case`, and the `gameStates` table is now `game_states`
  - `state` and `action_data` are native JSON columns
  - the unused `tokenType` column is gone
  - `game_states.player_id` is a foreign key to `players`

### Changed

- Dependencies updated to their latest compatible versions:
  - express 5.2.1, socket.io 4.8.4
  - TypeScript 6.0 (7 isn't supported by ts-jest or typescript-eslint yet)
  - ESLint 10, Jest 30.5, Prettier 3.9
- Removed dependencies:
  - `sequelize`, `sequelize-typescript` and `sqlite3`, replaced by MikroORM (`@mikro-orm/core`, `/sqlite`, `/decorators`, `/migrations`) and its `better-sqlite3` driver
  - `uuid`, replaced by `crypto.randomUUID()`
  - `zod`, replaced by validation in the database service
  - `ts-node` and `@types/jest`, which were unused
- Entities use standard (TC39) decorators with explicit property types, so neither `experimentalDecorators` nor decorator metadata is needed.
- Install scripts are declared in `allowScripts`. All three are denied: `better-sqlite3` ships prebuilt binaries, and the other two are optional Jest speedups.
- The lint and format toolchain is declared once, at the root.
- The e2e tests moved to the example package and use the library through its package entry point.
- Tests are type-checked by a separate `typecheck` step, which `npm test` runs first; ts-jest only transpiles.
- The whole project is ESM. Jest runs in its native ESM mode, which needs Node's `--experimental-vm-modules` flag; the `test` scripts set it.

### Added

- Schema migrations. They're applied on startup and recorded in `mikro_orm_migrations`, so persisted databases survive future schema changes.
- Battleship example: a shared `battleshipPlugin`.
- The example server has its own test suite, and `npm test` at the root runs every workspace.

### Fixed

- An empty owner name was accepted when creating a game.
- Security advisories: `npm audit` goes from 35 findings (2 critical, 21 high) to 0.
- Battleship example: ships could never be hit, because firing at any cell that wasn't `empty`, including a cell with a ship, was rejected as already targeted.
- Battleship example: players without a seat were treated as `player2` when placing ships, and saw `player1`'s ships.
- Battleship example: `restart` was rejected once a game was finished.
- Battleship example: `executeAction`, `addPlayer` and `removePlayer` modified the state passed to them.
- Battleship example: the built engine failed to load under ESM because of an import without the `.js` extension.

## 0.1.0 - 2026-09-29

### Breaking

- `GET /api/games/:gameId/state/:cursor` requires `Authorization: Bearer <token>` and returns that player's filtered view. The `x-player-id` header is no longer supported.
- The `GET` state response is now `{ gameId, stateId, sequence, state, timestamp }`. The placeholder `cursor` and `lastAction` fields were removed.
- `game-state-update` now carries `{ gameId, stateId, sequence, state }`.
- `player-left` now carries `{ playerId }` instead of `{ socketId }`.
- Socket authentication runs in the handshake. Rejected clients receive `connect_error` instead of an `error` event followed by a disconnect.
- The `leave-game` socket event is no longer handled.
- The library no longer installs `SIGINT`/`SIGTERM` handlers. Host applications register their own and call `shutdown()`.
- `RemoteStateServer.socketIOManager` is typed `SocketManager | null`.
- `createSocketManager` has a new signature, and the `SocketIOManager` alias was removed.
- `DatabaseService` takes two type parameters instead of three.
- Existing tables are no longer altered on startup. Databases created by earlier versions must be deleted.
- Tic-tac-toe example: players claim a seat with a `join` action, and `status` has a new `playing` value. `validateActionSimple` and `executeActionSimple` were removed.

### Added

- `POST /api/games/:gameId/actions` also accepts the token as a bearer header.
- The `GET` state response and `game-state-update` include `sequence`, the state's position in the game's history.
- Type exports: `GamePlugin`, `ActionValidationResult`, `RemoteStateServerConfiguration`, `SocketIOServerConfiguration`, `GameStateUpdateEvent` and `SocketManager`.
- `SocketManager.close()`.
- Tic-tac-toe example: a working browser client, a shared `ticTacToePlugin`, and a `PORT` environment variable.
- Documentation in `docs/`, a README, and root `build`, `test`, `lint` and `start:example` scripts.

### Fixed

- Socket authentication never checked the handshake `playerId` against the token.
- `game-state-update` sent an unresolved Promise instead of the state.
- Actions failed when the plugin had no `filterStateForPlayer`.
- State reads and action responses could return unfiltered state, revealing hidden information.
- `sequence` was never stored, so the "latest" state was arbitrary.
- Concurrent actions on one game could interleave. They are now serialized per game.
- Failed state writes were ignored and the action still reported success.
- `POST /api/games` hung instead of responding when it failed.
- Database initialization errors lost their original cause.
- Persisted databases stopped accepting actions after a restart, because `sync({ alter: true })` replaced the composite unique index with per-column constraints.
- Routes and static files the host app added were blocked by the catch-all 404 handler. It now only covers `/api`.
- Log levels set through configuration were ignored by loggers created at import time, and `logLevel: undefined` enabled every level.
- Errors logged as metadata were printed as `{}`.
- The tic-tac-toe example could not be played: no one could take a seat, the built server failed to start under ESM, and the web client was a mock.

### Removed

- Unused dependencies: `better-sqlite3` and `@types/validator` from the library, and `socket.io`, `socket.io-client` and `@types/better-sqlite3` from the example.

## 0.0.1

Initial development version.
