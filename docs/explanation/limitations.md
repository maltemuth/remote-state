# Known limitations

These are current properties of the library, not bugs in your game. Each one is a design decision that is still open. Settled decisions are recorded in [Decisions](decisions/README.md), proposals for open ones go in [Designs](designs/README.md), and planned fixes are listed in [BACKLOG.md](../../BACKLOG.md).

## Scaling

- **One process only.** The per-game lock is in memory, and Socket.IO uses its default in-memory adapter. Two instances sharing a database could interleave actions (the unique `sequence` index turns that into 500 errors rather than corrupt state), and each instance would only broadcast to its own sockets.
- **One busy thread.** Each action does several queries and the ORM's bookkeeping, and builds a view, plus a diff for `immer` clients, per audience connected, on the server's single thread. Under full load, requests queue up behind each other: with 100 battleship games played as fast as possible, a Windows desktop handled about 280 actions per second, with a p95 of about 330 ms. At human pace, the median stays around 5 ms ([measurements](../reference/performance.md)). Options are discussed in [Throughput and persistence](designs/throughput-and-persistence.md).
- **SQLite only.** MikroORM also supports Postgres, but the schema's version is kept in SQLite's `user_version`. Postgres would need another place for it, and its own driver configuration.
- **No database upgrades before 1.0.** A database from a version with another schema is refused and has to be deleted ([0048](decisions/0048-no-database-upgrades-before-1-0.md)).
- **Full snapshot per action.** Storage grows with (state size × number of actions), and nothing prunes old states. This gets much worse for state that grows over time, such as a move history, a hand log, a discard pile or a chat: each snapshot repeats everything before it, so total storage grows with the square of the number of actions. Every action also gets slower as the state grows, since loading, running the rules, filtering views, diffing and writing all work on the whole state. Diffs stay small. Deliberately left alone for now; the likely fix is a snapshot every N actions, with full-state diffs stored in between instead of states ([0050](decisions/0050-full-state-diffs-derived-not-stored.md)).
- **One state per game.** Everything in a game, including anything like a chat, shares one state, one lock and one `sequence`, so all actions of a game wait for each other. Separate states per game were considered and set aside for now.

## Protocol

- **Catching up is one jump.** `GET …/updates?since=` returns a single patch to the current view, so a client can't see or animate the steps it missed ([0030](decisions/0030-updates-in-one-jump.md)).
- **Connections aren't reported.** Neither the plugin nor clients are told when players connect or disconnect; the old `player-joined` and `player-left` events were removed. Presence itself is game logic ([0053](decisions/0053-restarts-are-game-logic.md)); reporting connections to the plugin is part of the [Game lifecycle](designs/game-lifecycle.md) proposal.
- **Views rebuilt after an audience change use the game's current filter.** If the filter changed since the client's `since`, the patch may not fit what the client holds ([0035](decisions/0035-updates-across-audiences.md)).
- **Unhandled WebSocket upgrades stay open when embedded.** Sockets leave upgrade requests for other paths alone, so instances can share a server ([0038](decisions/0038-several-games-by-mounting-several-instances.md)). On a host's own server, a request for a path nobody handles stays open until the client gives up, unless the host refuses it. The standalone server answers such requests with 404, until the host adds an `upgrade` listener of its own.
- **No versioning** of the API or of stored states.
- **Keys named `__proto__` and `constructor` are dropped** from states and views, at any depth, so that clients can apply every patch with Immer. A state that had them is logged as a warning ([0047](decisions/0047-reserved-keys-dropped-with-warning.md)).

## Security

- **Tokens never expire and can't be revoked** ([0018](decisions/0018-no-token-expiration-or-revocation.md)). A host replaces a lost token by admitting the same identity again, but the old one stays valid.
- **CORS allows every origin by default.** Set the `cors` option to restrict it.
- **No rate limiting** on the library's endpoints, including `POST /api/tokens`. Hosts protect their own endpoints and can put middleware in front of the library's ([0016](decisions/0016-authentication-in-library-authorization-by-implementer.md)).

## Operations

- **Installs from a lockfile need `--ignore-scripts`.** npm ignores `better-sqlite3`'s `gypfile: false` when installing from a lockfile, and tries to build it from source, which fails without a C++ compiler. `npm ci --ignore-scripts` installs it with its prebuilt binaries ([0064](decisions/0064-install-without-scripts.md)).

- **Hosts aren't told about state changes.** A computer player run by the host through `act` has to poll to find out it's its turn ([Server-initiated actions](designs/server-initiated-actions.md)).

- **Timers are lost on restart.** Pending timers are kept in memory only, so a restart drops them ([0042](decisions/0042-timer-restarts-open.md)). The library offers every game to the plugin's `onRestart` when it starts, where the game handles it, for example by pausing until it's resumed, or by scheduling them again ([0052](decisions/0052-games-pause-on-restart.md), [0053](decisions/0053-restarts-are-game-logic.md)). A game without `onRestart` that was waiting for a timeout waits until a player acts.

- **No game lifecycle.** Games are never closed, archived or deleted, players can't leave, and player activity isn't recorded.
