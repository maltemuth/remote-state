# Known limitations

These are current properties of the library, not bugs in your game. Each one is a design decision that is still open. Settled decisions are recorded in [Decisions](decisions/README.md), proposals for open ones go in [Designs](designs/README.md), and planned fixes are listed in [BACKLOG.md](../../BACKLOG.md).

## Scaling

- **One process only.** The per-game lock is in memory, and Socket.IO uses its default in-memory adapter. Two instances sharing a database could interleave actions (the unique `sequence` index turns that into 500 errors rather than corrupt state), and each instance would only broadcast to its own sockets.
- **About 100 actions per second per server under full load.** Each action waits for its own commit, synced to disk, and does about seven queries and three diffs, so requests queue up behind each other: with 100 battleship games played as fast as possible, p95 is several seconds. At human pace, latencies stay in the tens of milliseconds ([measurements](../reference/performance.md)). Options are discussed in [Throughput and persistence](designs/throughput-and-persistence.md).
- **SQLite only.** MikroORM also supports Postgres, but the migrations are written in SQLite's SQL. Postgres would need its own migrations and driver configuration.
- **Full snapshot per action.** Storage grows with (state size × number of actions), and nothing prunes old states. This gets much worse for state that grows over time, such as a move history, a hand log, a discard pile or a chat: each snapshot repeats everything before it, so total storage grows with the square of the number of actions. Every action also gets slower as the state grows, since loading, running the rules, filtering views, diffing and writing all work on the whole state. Diffs stay small. Deliberately left alone for now; the likely fix is a snapshot every N actions, with the stored full-state diffs ([0013](decisions/0013-store-full-state-diffs.md)) in between.
- **One state per game.** Everything in a game, including anything like a chat, shares one state, one lock and one `sequence`, so all actions of a game wait for each other. Separate states per game were considered and set aside for now.

## Protocol

- **Catching up is one jump.** `GET …/updates?since=` returns a single patch to the current view, so a client can't see or animate the steps it missed ([0030](decisions/0030-updates-in-one-jump.md)).
- **No presence.** Clients aren't told when other players connect or disconnect. The old `player-joined` and `player-left` events were removed; presence belongs to the [Game lifecycle](designs/game-lifecycle.md) proposal.
- **Views rebuilt after an audience change use the game's current filter.** If the filter changed since the client's `since`, the patch may not fit what the client holds ([0035](decisions/0035-updates-across-audiences.md)).
- **Unhandled WebSocket upgrades stay open.** Sockets leave upgrade requests for other paths alone, so instances can share a server ([0038](decisions/0038-several-games-by-mounting-several-instances.md)). A request for a path nobody handles stays open until the client gives up, also on the standalone server.
- **No versioning** of the API or of stored states.
- **Keys named `__proto__` and `constructor` are dropped** from states and views, at any depth, so that clients can apply every patch with Immer. A state that had them is logged as a warning ([0047](decisions/0047-reserved-keys-dropped-with-warning.md)).

## Security

- **Tokens never expire and can't be revoked** ([0018](decisions/0018-no-token-expiration-or-revocation.md)). A host replaces a lost token by admitting the same identity again, but the old one stays valid.
- **CORS allows every origin by default.** Set the `cors` option to restrict it.
- **No rate limiting** on the library's endpoints, including `POST /api/tokens`. Hosts protect their own endpoints and can put middleware in front of the library's ([0016](decisions/0016-authentication-in-library-authorization-by-implementer.md)).

## Operations

- **Hosts aren't told about state changes.** A computer player run by the host through `act` has to poll to find out it's its turn ([Server-initiated actions](designs/server-initiated-actions.md)).

- **Timers are lost on restart.** Pending timers are kept in memory only, so a restart drops them, and a game waiting for a timeout waits until a player acts. How timers should behave across restarts is still open ([0042](decisions/0042-timer-restarts-open.md)).

- **No game lifecycle.** Games are never closed, archived or deleted, players can't leave, and nothing uses `lastActivityAt`.
