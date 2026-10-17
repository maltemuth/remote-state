# 0024. Views are computed per audience

Status: Accepted; default audiences settled by [0025](0025-default-audiences.md); a player who changes audience gets a computed diff rather than a whole state, per [0035](0035-updates-across-audiences.md); diffs per audience are no longer stored, per [0056](0056-views-and-patches-computed-when-sent.md)
Date: 2026-09-29

## Context

Every connection gets a view filtered for one player ([0010](0010-every-game-has-hidden-information.md)), and every action computes and stores a diff of each player's view ([0012](0012-store-player-diffs.md)). Where many players see the same thing, such as spectators in poker or everyone in chess, that repeats the same work and stores the same diff many times. The [Audiences](../designs/audiences.md) proposal describes the problem.

Here, a player is anyone admitted to a game ([0020](0020-hosts-admit-players-through-codes.md)), whether they hold a seat or only watch; that's the game's business ([0022](0022-roles-belong-to-game-state.md)).

## Decision

- **Views are filtered per audience,** a group of players who all see the same view. The game filters the state for an audience instead of for a player.
- **Every player belongs to exactly one audience,** stored on the player.
- **Each action computes one view and one diff per audience,** and stores the diffs by audience instead of by player.
- **Audience membership is recorded after each action,** so it's known which audience each player was in, and so what they were sent, at every `sequence`.
- **A player who changes audience starts from a whole state.** Their last known `sequence` refers to the old audience's views, so it can't be caught up with the new audience's diffs.

## Alternatives considered

- **Views per player,** as before. Simple, but the cost grows with the number of players even where they all see the same.
- **Membership computed from the state on demand,** by a game function, instead of stored. Nothing to keep in sync, but the history of who saw what would have to be recomputed, and would change if the function changed.
- **Several audiences per player,** for example a coach who sees their team and the public table. A view would no longer be a single state; such a player gets an audience of their own instead.

## Consequences

- Spectators need no concept of their own: they're players in an audience the game chooses.
- A game without hidden information can use a single audience, and costs one view and one diff per action, however many players it has.
- Storage of diffs grows with audiences × actions, not players × actions. Membership records grow with players × actions, but are small.
- Stored diffs move from player to audience, which supersedes that part of [0012](0012-store-player-diffs.md), with a migration.
- The game needs a way to set a player's audience when they join, and to change it; that's part of designing the join hook ([Authorization](../designs/authorization.md)).
- Still open ([Audiences](../designs/audiences.md)): what games that describe no audiences get by default.
