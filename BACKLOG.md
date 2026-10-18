# Backlog

Planned work that doesn't depend on open design questions. Work that does is discussed in [design proposals](docs/explanation/designs/README.md) first.

Remove an item when it's done; the changelog records what changed. Items are in order of priority.

- [ ] **Tokens that expire, and can be revoked.** Today a token is valid forever, also after the host admits the same identity again to replace a lost one ([0018](docs/explanation/decisions/0018-no-token-expiration-or-revocation.md)), so a leaked token can't be shut out. Needed before anything public. Takes a record superseding 0018, and picks up the deferred part of [Authorization](docs/explanation/designs/authorization.md).
- [ ] **Tell the host about state changes.** A computer player run by the host through `act` has to poll to find out it's its turn, and a host can't keep a lobby of running games up to date without reading every game ([Server-initiated actions](docs/explanation/designs/server-initiated-actions.md)).

## Stretch goals

Beyond what the library is for: readable, reasonable code, and state that's guaranteed to be in sync. Each needs a design proposal before any code, and games can be much more complicated than the examples.

- [ ] **Realtime-capable performance.** Where it stands: [Performance measurements](docs/reference/performance.md), [Throughput and persistence](docs/explanation/designs/throughput-and-persistence.md) and [Games in memory](docs/explanation/designs/games-in-memory.md).
- [ ] **Events instead of state.** Each audience gets the action, plus the hidden values that became visible to it, such as dealt or revealed cards. Clients apply them to a masked copy of the state with the game's own rules, and derive their view with the game's own view function. That allows animating each step, and catching up step by step. A reveal isn't a step from one visible state to another, so the event has to carry what was revealed. poker-game already takes all new hidden information through one injected `draw`; a first step would be a spike there: replay generated hands on the server and on masked tables, and compare the views. The filter-based view stays the reference, checked by tests and live by the checksum ([0059](docs/explanation/decisions/0059-checksums-with-patches.md)). It needs new plugin hooks, rules that never look at what a client can't know, and the game's code on the client.
