# Known limitations

Current properties of the library, each an open design question. Settled ones are in [Decisions](decisions/README.md), proposals in [Designs](designs/README.md), planned fixes in [BACKLOG.md](../../BACKLOG.md).

## Scaling

- **One process only.** The per-game lock and Socket.IO's adapter are in memory. Two instances on one database would interleave actions, which the unique `sequence` index turns into 500s, and each would broadcast only to its own sockets.
- **One busy thread.** Under full load, actions queue: 100 battleship games played flat out gave about 280 actions per second, p95 about 330 ms. At human pace, the median is about 5 ms ([measurements](../reference/performance.md), [Throughput and persistence](designs/throughput-and-persistence.md)).
- **SQLite only.** MikroORM supports Postgres, but the schema version lives in SQLite's `user_version`.
- **No database upgrades before 1.0** ([0048](decisions/0048-no-database-upgrades-before-1-0.md)).
- **A full snapshot per action,** never pruned. A state that grows, such as a log or a chat, makes storage grow with the square of the actions, and every action slower. The likely fix is a snapshot every N actions, with diffs between ([0050](decisions/0050-full-state-diffs-derived-not-stored.md)).
- **One state per game.** Everything in a game shares one state, lock and `sequence`.

## Protocol

- **Catching up is one jump,** so a client can't replay the steps it missed ([0030](decisions/0030-updates-in-one-jump.md)).
- **Connections aren't reported** to the plugin or to clients ([Game lifecycle](designs/game-lifecycle.md)).
- **Views rebuilt after an audience change use the current filter,** so a patch may not fit if the filter changed since ([0035](decisions/0035-updates-across-audiences.md)).
- **Unhandled WebSocket upgrades stay open when embedded,** until the client gives up or the host refuses them. The standalone server answers them with 404 ([0038](decisions/0038-several-games-by-mounting-several-instances.md)).
- **No versioning** of the API or of stored states.
- **Keys named `__proto__` and `constructor` are dropped,** with a warning ([0047](decisions/0047-reserved-keys-dropped-with-warning.md)).

## Security

- **Tokens never expire and can't be revoked** ([0018](decisions/0018-no-token-expiration-or-revocation.md)).
- **CORS allows every origin** unless the `cors` option says otherwise.
- **No rate limiting,** including on `POST /api/tokens`; hosts can put middleware in front ([0016](decisions/0016-authentication-in-library-authorization-by-implementer.md)).

## Operations

- **Installs from a lockfile need `--ignore-scripts`,** or npm tries to build `better-sqlite3` from source ([0064](decisions/0064-install-without-scripts.md)).
- **Hosts aren't told about state changes,** so a computer player run through `act` has to poll ([Server-initiated actions](designs/server-initiated-actions.md)).
- **Timers are lost on restart.** Games handle it in `onRestart`; without it, a game waiting for a timeout waits for a player ([0052](decisions/0052-games-pause-on-restart.md), [0053](decisions/0053-restarts-are-game-logic.md)).
- **No game lifecycle.** Games are never closed or deleted, and players can't leave.
