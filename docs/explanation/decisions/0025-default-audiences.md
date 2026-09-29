# 0025. Default audiences depend on whether the game filters views

Status: Accepted
Date: 2026-09-29

## Context

Views are computed per audience, and each player belongs to one ([0024](0024-views-per-audience.md)). A game that describes no audiences still needs some. Games differ in what's safe and what's wasteful: without a view filter, every player sees the whole state; with one, players may see different things.

## Decision

A game that describes no audiences gets:

- **A single audience for everyone,** when it has no view filter.
- **One audience per player,** when it has a view filter.

## Alternatives considered

- **Always one audience per player,** as today. Always safe, but repeats the same view, diff and storage for every player of a game without a view filter.
- **Always a single audience.** Cheapest, but a game with a view filter that doesn't declare audiences would show every player the view filtered for one of them, leaking hidden information.

## Consequences

- Games without hidden information, such as tic-tac-toe, cost one view and one diff per action with no configuration.
- Games with a view filter behave as they do today until they declare audiences, for example to share a spectator view.
- Adding a view filter to a game changes its default audiences, and so how its diffs are stored. Existing games' stored history stays valid: a player moving to a new audience starts from a whole state ([0024](0024-views-per-audience.md)).
