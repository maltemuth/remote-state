# Games in memory, the database as a backup

Status: Open. The shape is agreed, below; when transitions are written, and what a restart goes back to, is open; bounding memory is deferred.

## Problem

The database is the source of truth. Every action reads its game from the database and writes the new state, its history and its diffs in one transaction before it's answered. That's most of the work per action: about seven queries, the ORM's unit of work, and a commit ([measurements](../../reference/performance.md)). It also ties every design question about speed to the database ([Throughput and persistence](throughput-and-persistence.md)).

What a restart needs from the database is different: a **well-defined state** of every game, one it really was in, more than the latest one. [0054](../decisions/0054-wal-without-syncing-every-commit.md) already accepts losing the last actions on a power loss, as long as the database stays consistent.

So: keep games in memory, act on them there, and write them to the database behind, as a backup.

## Constraints

- **One process per game,** as today ([Known limitations](../limitations.md#scaling)).
- **A restart restores each game to a state it was in,** with its history up to that state, and nothing after it.
- **What a game does after a restart stays game logic** ([0053](../decisions/0053-restarts-are-game-logic.md)): `onRestart` gets the restored state.
- **Clients recover by themselves** from a game that went back.
- **Room for the game to say what's worth restoring.** A poker table is better restored between hands than in the middle of one. The design mustn't rule that out, even if it isn't built first.

## Agreed so far

### Games live in memory

A game's latest state, sequence, players and audiences are kept in memory. An action is validated and executed against that state, and answered and broadcast without waiting for the database. Reading a view, catching up and connecting a socket read from memory too, so they agree with what was broadcast.

### History is kept

Every transition is still written: the full state, the action, and each audience's diff, as today ([0050](../decisions/0050-full-state-diffs-derived-not-stored.md)). They're written behind, not on the action's path, and always in order, so the database holds every game's history up to some transition, with no gaps.

### Admission is written through

Admitting a player, and issuing tokens and admission codes, are written before they're answered. They're rare, and losing one would lock a player out after a restart.

### Clients notice a game that went back

Sequences alone can't tell a client that a game went back. After a restart at sequence 40, a client holding 45 ignores the whole view at 40, since it's older than its own, and the next actions reuse 41 to 45, so a patch at 46 would be applied to the wrong view.

So every state a client gets carries a **generation** along with the sequence: a value that changes whenever a game is restored from the database. A client that sees another generation drops its view and takes the whole view it's given. `GET …/updates` answers with the whole view when `since` belongs to another generation.

This is needed already: with 0054, a power loss can take a game back a few actions today.

## Open: when transitions are written, and what a restart goes back to

These are left open, to keep room for designing them. The options aren't exclusive.

### A. As soon as possible

A writer takes whatever transitions are pending, writes them in one transaction, and repeats. Under load, one commit covers many actions. A restart goes back to the last transition written, which is usually close to the latest.

### B. In batches, by time or count

Write every N milliseconds or N transitions. Fewer, larger commits, and a predictable bound on what's lost.

### C. Restore points marked by the game

The plugin marks some states as worth restoring, for example a poker table between hands. A restart goes back to the last marked state of each game, even if later transitions were written. Those later transitions then aren't part of the game any more: dropped, or kept apart as a record of what happened.

### D. A clean shutdown writes everything

`close()` waits until every pending transition is written. A planned restart then loses nothing, whichever of A to C applies to crashes.

## Deferred: bounding memory

Every game stays in memory once loaded. A bound, by count or size, and dropping idle games that are fully written, can come later; dropping a written game costs nothing but loading it again.

## Consequences

- An action no longer waits for the database. What it costs is the game's rules, filtering views and diffing.
- A crash loses the transitions not yet written. Players may have seen them; the generation takes their clients back to the restored state.
- The host's `act` and timers behave as today, against the state in memory.
- Several options of [Throughput and persistence](throughput-and-persistence.md) are covered: B (games in memory) and D (group commit), and E's separation of executing from writing, without changing the API.

## Open questions

- Which of A to D, or which combination, and whether the game or the host chooses.
- With C, what happens to transitions after the last restore point.
- Whether a generation belongs to a game, changing when it's restored, or to a server start.
- How long recent diffs stay in memory for `GET …/updates`, and when catching up reads the database instead.
