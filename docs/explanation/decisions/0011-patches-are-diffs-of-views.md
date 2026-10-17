# 0011. Patches are diffs of player views; only full states are stored

Status: Accepted; storage extended by [0012](0012-store-player-diffs.md), which also stores each player's diffs; views are per audience by [0024](0024-views-per-audience.md); computed by default by the library's own diff, comparing arrays by position, per [0057](0057-own-diff-arrays-by-position.md), with `rfc6902` kept as the reference and an option, per [0058](0058-rfc6902-kept-as-reference-and-option.md)
Date: 2026-09-29

## Context

Clients may choose patches instead of whole states ([0007](0007-client-chosen-update-format.md)), and every game is treated as having hidden information ([0010](0010-every-game-has-hidden-information.md)). A player may only receive patches that describe their own view, and views come from `filterStateForPlayer`, a function the game writes.

Recording patches with Immer while the rules run was considered first. It produces patches of the _full_ state, which can leak hidden information, and turning those into per-player patches needs one of:

- a second, patch-level filter written by each game, which must agree with its view filter
- visibility declared by path, which only works if views are projections of the state. That would make the game's state cater to its views, and rule out views that compute or present data.
- view filters written as Immer producers. Tested, this gave exact patches only when authors hand-wrote every change a second time.

The view function is worth keeping as it is: it allows calculations and real presentations of data, not just projections.

## Decision

- **Only full states are stored.** No patches are recorded or stored with them.
- **Patches are computed from views.** For each player, the external patches are the difference between their previous view and their new view, computed with the [`rfc6902`](https://www.npmjs.com/package/rfc6902) library. It produces standard JSON Patch. For clients that choose Immer's format, the paths are converted to arrays.
- **The plugin interface doesn't change.** `executeAction` may change the state it receives or return a new one, since each action gets a fresh copy loaded from the database. It may stay `async`. Immer isn't used on the server.
- **Minimal patches are a goal, but not a first concern.** The patches must be correct; how small they are can improve later.

## Alternatives considered

- **Patches recorded by Immer while the rules run,** filtered per player by a game-written patch filter, declared visibility, or producer-style view functions. See the context above.
- **`microdiff`.** It compares arrays position by position, so its board patches are always minimal. Its output needs converting to JSON Patch, and minimality isn't a first concern. `rfc6902` produces standard JSON Patch directly, and can also apply patches, which is useful for checking them.

## Consequences

- **Hidden information is safe by construction.** A diff of two views can only contain what the player's views contain.
- **Reveals need no special handling.** Data that becomes visible simply appears in the diff.
- **An empty diff** means the player's view didn't change.
- **The previous view must be the real previous view.** Since the rules may change the loaded state in place, previous views are computed before `executeAction` runs, or recomputed from the stored previous state.
- **Cost per update:** for each player, one or two view computations, plus a diff. That's fine for board-game-sized views.
- **Catch-up needs diffing in any case.** A client asking "what changed since sequence 7?" can only be answered by comparing its view at 7 with later views, whether or not patches were recorded while the rules ran. Using diffs for live updates too means one mechanism for both.
- **`GET …/updates` recomputes from history** ([0009](0009-separate-state-and-update-endpoints.md)). It can answer step by step, diffing the views before and after each missed step, which keeps every step. Or it can answer in one jump, diffing the view at `since` with the current view, which is smaller but loses the steps in between.
- **Patches aren't always minimal.** `rfc6902` treats arrays as lists, and on sparse boards it can describe a move as inserting and removing rows. The patches are still correct. `microdiff` remains an option if this matters.
- **`filterStateForPlayer` must be a pure function of the state and player,** so a view computed now matches the one sent earlier.
