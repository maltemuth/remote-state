# 0038. Several games share a server by mounting several instances

Status: Accepted
Date: 2026-10-04

## Context

Each server hosted exactly one game plugin. Hosting tic-tac-toe and battleship side by side needed two servers on two ports. The backlog listed this as possibly needing a design: one instance serving several plugins would need a game type per game, routing of actions to the right plugin, and shared or separate storage.

With an embeddable core ([0037](0037-embeddable-core-and-server-options.md)), a host can mount one instance per game in the same app and attach each to the same HTTP server.

## Decision

The library serves one game plugin per instance. A host serves several games by creating one instance per game, each mounted under its own prefix, with its own socket path and its own database file. The example host serves tic-tac-toe under `/tic-tac-toe` and battleship under `/battleship` this way.

Sockets leave upgrade requests for other paths alone, so several instances, and the host's own WebSockets, can share one HTTP server.

## Alternatives considered

- **One instance with several plugins,** choosing the plugin by a game type stored with each game. One API, one socket and one database, but every route, every stored game and the host API would need to know about game types, for a need that mounting already covers.

## Consequences

- No change to the plugin contract, the API or the schema.
- Each game type has its own URL prefix, socket path and database.
- A client of several game types connects once per game type it plays.
