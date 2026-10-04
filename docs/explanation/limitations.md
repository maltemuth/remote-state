# Known limitations

These are current properties of the library, not bugs in your game. Each one is a design decision that is still open. Settled decisions are recorded in [Decisions](decisions/README.md), proposals for open ones go in [Designs](designs/README.md), and planned fixes are listed in [BACKLOG.md](../../BACKLOG.md).

## Scaling

- **One process only.** The per-game lock is in memory, and Socket.IO uses its default in-memory adapter. Two instances sharing a database could interleave actions (the unique `sequence` index turns that into 500 errors rather than corrupt state), and each instance would only broadcast to its own sockets.
- **SQLite only.** MikroORM also supports Postgres, but the migrations are written in SQLite's SQL. Postgres would need its own migrations and driver configuration.
- **Full snapshot per action.** Storage grows with (state size × number of actions), and nothing prunes old states. This gets much worse for state that grows over time, such as a move history, a hand log, a discard pile or a chat: each snapshot repeats everything before it, so total storage grows with the square of the number of actions. Every action also gets slower as the state grows, since loading, running the rules, filtering views, diffing and writing all work on the whole state. Diffs stay small. Deliberately left alone for now; the likely fix is a snapshot every N actions, with the stored full-state diffs ([0013](decisions/0013-store-full-state-diffs.md)) in between.
- **One state per game.** Everything in a game, including anything like a chat, shares one state, one lock and one `sequence`, so all actions of a game wait for each other. Separate states per game were considered and set aside for now.

## Protocol

- **Catching up is one jump.** `GET …/updates?since=` returns a single patch to the current view, so a client can't see or animate the steps it missed ([0030](decisions/0030-updates-in-one-jump.md)).
- **No presence.** Clients aren't told when other players connect or disconnect. The old `player-joined` and `player-left` events were removed; presence belongs to the [Game lifecycle](designs/game-lifecycle.md) proposal.
- **Views rebuilt after an audience change use the game's current filter.** If the filter changed since the client's `since`, the patch may not fit what the client holds ([0035](decisions/0035-updates-across-audiences.md)).
- **No versioning** of the API or of stored states.

## Security

- **Tokens never expire and can't be revoked** ([0018](decisions/0018-no-token-expiration-or-revocation.md)). A host replaces a lost token by admitting the same identity again, but the old one stays valid.
- **CORS allows every origin by default.** Set the `cors` option to restrict it.
- **No rate limiting** on the library's endpoints, including `POST /api/tokens`. Hosts protect their own endpoints and can put middleware in front of the library's ([0016](decisions/0016-authentication-in-library-authorization-by-implementer.md)).

## Operations

- **No game lifecycle.** Games are never closed, archived or deleted, players can't leave, and nothing uses `lastActivityAt`.
- **Admission codes are kept.** Used and expired codes are never deleted.
