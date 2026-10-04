# 0039. Actions are logged and recorded with their author's audience

Status: Accepted
Date: 2026-10-04

## Context

A player's audience can change during a game ([0024](0024-views-per-audience.md), [0027](0027-audiences-set-by-join-hook-and-actions.md)), for example from their own audience to `spectators`. To tell actions apart later, for example a seated player's moves from their chat as a spectator, it helps to see the audience an action was made from. Actions can also come from the system rather than a player ([Server-initiated actions](../designs/server-initiated-actions.md)).

The audience at any `sequence` can already be worked out from the membership history, but not at a glance, and not in the server log.

## Decision

- **The server log** names the author of every recorded transition as `<audience>:<playerId>`, for example `spectators:4f1c…`, or `system` for system actions.
- **The history** gets an `audience` column next to `player_id` on each state: the author's audience when they acted, or, for a join, the audience they joined into. It's null for the initial state and for system actions.

The ID that games see stays the plain player ID.

## Alternatives considered

- **Storing `<audience>:<playerId>` in `player_id`.** One column, but it breaks the link to the players table.
- **Giving games the combined ID.** A player's ID would change with their audience, so games couldn't recognize them across an audience change.

## Consequences

- A migration adds the column; existing rows keep it empty.
- Reading the history shows who acted from which audience without consulting the membership history.
- One log line per action, at `info`.
