# Known limitations

These are current properties of the library, not bugs in your game. Each one is a design decision that is still open. Settled decisions are recorded in [Decisions](decisions/README.md), proposals for open ones go in [Designs](designs/README.md), and planned fixes are listed in [BACKLOG.md](../../BACKLOG.md).

## Scaling

- **One process only.** The per-game lock is in memory, and Socket.IO uses its default in-memory adapter. Two instances sharing a database could interleave actions (the unique `sequence` index turns that into 500 errors rather than corrupt state), and each instance would only broadcast to its own sockets.
- **SQLite only.** MikroORM also supports Postgres, but the migrations are written in SQLite's SQL. Postgres would need its own migrations and driver configuration.
- **Full snapshot per action.** Storage grows with (state size × number of actions), and nothing prunes old states.

## Protocol

- **The `:cursor` in `GET /api/games/:gameId/state/:cursor` is ignored.** It always returns the latest state. There is no way to fetch a past state or the states since a given `sequence`.
- **No replay of missed updates.** A reconnecting client can only fetch the latest state, so it sees the result but not the intermediate steps.
- **`player-joined` means two things.** It's sent both when a player registers over HTTP and when a player's socket connects.
- **Tokens are accepted in two places for actions** (body and bearer header) but only one for reads (bearer header).
- **No versioning** of the API or of stored states.

## Security

- **Tokens never expire** and can't be revoked or reissued.
- **`POST /admin/log-level` is unauthenticated.** It's disabled only when `NODE_ENV=production`.
- **HTTP CORS is open to every origin**, and it isn't configurable.
- **No rate limiting** on any endpoint, including game creation.
- **The `admin` role is recorded but grants nothing.**

## Operations

- **Process-wide log level.** `minimumLogLevel` changes the level for every logger in the process, including other servers in the same process.
- **No game lifecycle.** Games are never closed, archived or deleted, and nothing uses `lastActivityAt`.
