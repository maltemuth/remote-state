# 0055. The view sent on connect replaces the client's, whatever its sequence

Status: Accepted
Date: 2026-10-17

## Context

Sequences only increased, so clients ignored every update at or before the sequence they held ([0044](0044-client-hands-out-whole-views.md)). Since [0054](0054-wal-without-syncing-every-commit.md), a power loss can take the database back a few actions, and [Games in memory](../designs/games-in-memory.md) would take games back on every crash. After a restart at sequence 40, a client holding 45 would ignore the whole view at 40, then ignore the next actions, which reuse 41 to 45, and apply the patch at 46 to the wrong view.

A game can only go back when the server restarts, and a restart drops every socket. Every connected client reconnects, and on every connect the server sends the whole view first ([0031](0031-socket-sends-state-on-connect.md)).

## Decision

- **The whole view sent on a (re)connect replaces the client's view,** even if its sequence is lower. Updates on that socket follow from it.
- **A whole view fetched while catching up replaces it too.** Updates wait while the client catches up, so a whole view at another sequence than the one it asked from means the server went back. A `since` the server doesn't have yet is answered with 404, and the client fetches the whole view, as before.

The server doesn't change.

## Alternatives considered

- **A generation in every update,** changing whenever a game is restored, so clients compare it and not just the sequence. It also covers clients that only poll over HTTP, but needs a field in every event and response, for a case the reconnect already marks.

## Consequences

- A client that only polls `GET …/updates`, without a socket, can't tell that a game went back if it moved past the client's sequence again before the client asked. It would apply a patch from the new history to its old view. If such clients matter, the generation is the way to cover them.
- A client's `waitFor` for a sequence that was lost resolves once the game reaches that sequence again, with whatever state it has then.
