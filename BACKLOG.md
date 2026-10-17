# Backlog

Planned work that doesn't depend on open design questions. Work that does is discussed in [design proposals](docs/explanation/designs/README.md) first.

Remove an item when it's done; the changelog records what changed. Items are in order of priority.

- [ ] **Tokens that expire, and can be revoked.** Today a token is valid forever, also after the host admits the same identity again to replace a lost one ([0018](docs/explanation/decisions/0018-no-token-expiration-or-revocation.md)), so a leaked token can't be shut out. Needed before anything public. Takes a record superseding 0018, and picks up the deferred part of [Authorization](docs/explanation/designs/authorization.md).
- [ ] **Tell the host about state changes.** A computer player run by the host through `act` has to poll to find out it's its turn, and a host can't keep a lobby of running games up to date without reading every game ([Server-initiated actions](docs/explanation/designs/server-initiated-actions.md)).
