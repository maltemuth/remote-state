# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/). Before 1.0, minor versions may contain breaking changes.

## Unreleased

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

