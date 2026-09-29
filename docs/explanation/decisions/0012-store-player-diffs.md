# 0012. Store each player's diffs alongside the full states

Status: Accepted; diffs are stored in Immer's format per [0014](0014-immer-patches-only-external-format.md); superseded in part by [0024](0024-views-per-audience.md), which stores diffs per audience instead of per player
Date: 2026-09-29

## Context

Patches are diffs of player views, computed when an update is sent ([0011](0011-patches-are-diffs-of-views.md)). As decided in 0011, only full states were stored, so answering "what changed since sequence 7?" meant recomputing views from the stored states and diffing them again.

## Decision

For every accepted action, the server computes the diff of each registered player's view, and stores it with the new state, whether or not the player is connected. Diffs are stored in JSON Patch format, including empty ones.

The full states remain the source of truth. The stored diffs record what each player was sent.

## Alternatives considered

- **Recomputing diffs when asked,** as in 0011. It stores less, but repeats work on every catch-up, and only gives the same answer as the original updates if `filterStateForPlayer` never changes.

## Consequences

- **Catch-up is a read.** `GET …/updates?since=<sequence>` returns the stored diffs, step by step.
- **A one-jump answer is also a read.** Concatenating the stored diffs after `since` gives a valid patch from the view at `since` to the current view. It's correct, though not minimal.
- **What was sent is recorded.** Each player's stored diffs show exactly what they could see at each step, which helps debugging.
- **Changing a game's view filter doesn't change history.** Stored diffs stay as they were sent, even if a later version of the game filters differently.
- **Every action diffs every registered player's view,** not only those of connected players. Storage grows with the number of players multiplied by the number of actions, which is small for board games.
- **Players who register later** have no diffs from before they joined. They start from a whole state, as every first connection does.
- **Empty diffs are stored,** so a player's history has no gaps, and "no change" can be told apart from "missing".
- **The schema gets a new table** for player diffs, keyed by game, player and `sequence`, with a migration.
