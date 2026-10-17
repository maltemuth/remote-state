# Decisions

Records of design decisions: what was decided, in what context, and what was rejected. They explain why the project is the way it is. For how it currently behaves, see the [reference](../../reference/) and [Architecture](../architecture.md).

Records aren't edited after the fact, except to update their status. A decision that changes gets a new record, and the old one is marked as superseded.

| #                                                                      | Decision                                                                       | Status                                                                |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| [0001](0001-http-actions-socket-updates.md)                            | Actions over HTTP, updates over Socket.IO                                      | Accepted                                                              |
| [0002](0002-node-24.md)                                                | Require Node.js 24                                                             | Accepted                                                              |
| [0003](0003-no-known-vulnerabilities.md)                               | Ship with no known dependency vulnerabilities                                  | Accepted                                                              |
| [0004](0004-esm-with-jest.md)                                          | ESM throughout, tested with Jest                                               | Accepted, superseded for tests by 0051                                |
| [0005](0005-mikro-orm.md)                                              | MikroORM with standard decorators for the data layer                           | Accepted; migrations dropped by 0048                                  |
| [0006](0006-single-process.md)                                         | Run as a single process for now                                                | Accepted                                                              |
| [0007](0007-client-chosen-update-format.md)                            | Clients choose the format of state updates                                     | Accepted, refined by 0009 and 0014                                    |
| [0008](0008-format-query-parameter.md)                                 | The update format is chosen with a `format` query parameter                    | Accepted for the socket (values per 0014), superseded for GET by 0009 |
| [0009](0009-separate-state-and-update-endpoints.md)                    | Separate GET endpoints for whole state and for updates                         | Accepted                                                              |
| [0010](0010-every-game-has-hidden-information.md)                      | Every game is treated as a game with hidden information                        | Accepted, refined by 0024                                             |
| [0011](0011-patches-are-diffs-of-views.md)                             | Patches are diffs of player views; only full states are stored                 | Accepted, storage extended by 0012, views per audience by 0024        |
| [0012](0012-store-player-diffs.md)                                     | Store each player's diffs alongside the full states                            | Accepted, superseded in part by 0024                                  |
| [0013](0013-store-full-state-diffs.md)                                 | Also store diffs of the full state                                             | Superseded by 0050                                                    |
| [0014](0014-immer-patches-only-external-format.md)                     | Immer's patch format is the only external patch format                         | Accepted for now                                                      |
| [0015](0015-library-issues-opaque-tokens.md)                           | The library issues its own opaque tokens                                       | Accepted                                                              |
| [0016](0016-authentication-in-library-authorization-by-implementer.md) | The library authenticates; implementers authorize                              | Accepted                                                              |
| [0017](0017-hashed-tokens-in-header-and-handshake.md)                  | Tokens are stored hashed, and accepted only in the header and the handshake    | Accepted                                                              |
| [0018](0018-no-token-expiration-or-revocation.md)                      | Tokens don't expire and can't be revoked                                       | Accepted for now                                                      |
| [0019](0019-several-tokens-per-player.md)                              | A player can have several tokens                                               | Accepted                                                              |
| [0020](0020-hosts-admit-players-through-codes.md)                      | Hosts admit players through single-use codes                                   | Accepted                                                              |
| [0021](0021-games-created-with-creategame.md)                          | Hosts create games with `createGame`, separately from admitting players        | Accepted, refined by 0036                                             |
| [0022](0022-roles-belong-to-game-state.md)                             | Roles belong to the game's state and rules                                     | Accepted                                                              |
| [0023](0023-no-server-to-server-admit.md)                              | `admit` is only called in-process                                              | Accepted                                                              |
| [0024](0024-views-per-audience.md)                                     | Views are computed per audience                                                | Accepted, refined by 0035                                             |
| [0025](0025-default-audiences.md)                                      | Default audiences depend on whether the game filters views                     | Accepted                                                              |
| [0026](0026-join-hook-is-a-state-transition.md)                        | Joining a game is a state transition run by the game                           | Accepted                                                              |
| [0027](0027-audiences-set-by-join-hook-and-actions.md)                 | Audiences are set by the join hook and by actions                              | Accepted                                                              |
| [0028](0028-no-operational-endpoints.md)                               | The library installs no operational endpoints                                  | Superseded by 0049                                                    |
| [0029](0029-sequence-is-the-cursor.md)                                 | The `sequence` is the client's cursor                                          | Accepted                                                              |
| [0030](0030-updates-in-one-jump.md)                                    | `GET …/updates` answers in one jump, from any `since`                          | Accepted                                                              |
| [0031](0031-socket-sends-state-on-connect.md)                          | The socket sends the current state on connect                                  | Accepted                                                              |
| [0032](0032-action-response-without-body.md)                           | Accepted actions are answered with 201 and no body                             | Superseded by 0034                                                    |
| [0033](0033-no-optimistic-updates.md)                                  | Clients wait for the server before showing an action's result                  | Accepted                                                              |
| [0034](0034-action-response-with-sequence.md)                          | Accepted actions are answered with 201 and their `sequence`                    | Accepted                                                              |
| [0035](0035-updates-across-audiences.md)                               | Updates across audience changes are computed; otherwise 303 to the whole state | Accepted                                                              |
| [0036](0036-hosts-pass-the-initial-state.md)                           | Hosts pass the initial state; the library knows no game options                | Accepted                                                              |
| [0037](0037-embeddable-core-and-server-options.md)                     | The library is an embeddable core; deployment settings are server options      | Accepted                                                              |
| [0038](0038-several-games-by-mounting-several-instances.md)            | Several games share a server by mounting several instances                     | Accepted                                                              |
| [0039](0039-actions-recorded-with-authors-audience.md)                 | Actions are logged and recorded with their author's audience                   | Accepted                                                              |
| [0040](0040-server-initiated-actions.md)                               | Games schedule actions, and hosts can act as the system                        | Accepted                                                              |
| [0041](0041-named-timers.md)                                           | Timers are named, stored, and restart with the server                          | Accepted in part; restarts reopened by 0042                           |
| [0042](0042-timer-restarts-open.md)                                    | What happens to timers on a restart is still open                              | Accepted, refined by 0052                                             |
| [0043](0043-client-core-without-state-library.md)                      | The client package starts as a core without a state library                    | Accepted                                                              |
| [0044](0044-client-hands-out-whole-views.md)                           | The client hands out whole views and catches up by sequence                    | Accepted                                                              |
| [0045](0045-client-generic-over-game-types.md)                         | The client is generic over the game's types                                    | Accepted                                                              |
| [0046](0046-reserved-keys-documented.md)                               | Reserved keys in states are documented, not handled                            | Superseded by 0047                                                    |
| [0047](0047-reserved-keys-dropped-with-warning.md)                     | Reserved keys are dropped from states, with a warning                          | Accepted                                                              |
| [0048](0048-no-database-upgrades-before-1-0.md)                        | No database upgrades before 1.0                                                | Accepted                                                              |
| [0049](0049-health-check-under-the-api.md)                             | One operational endpoint: a health check under the API                         | Accepted                                                              |
| [0050](0050-full-state-diffs-derived-not-stored.md)                    | Full-state diffs are derived, not stored                                       | Accepted                                                              |
| [0051](0051-tests-on-nodes-test-runner.md)                             | Tests run on Node's test runner, through tsx                                   | Accepted                                                              |
| [0052](0052-games-pause-on-restart.md)                                 | On a restart, every game is offered to the plugin, which pauses itself         | Accepted, refined by 0053                                             |
| [0053](0053-restarts-are-game-logic.md)                                | What a game does on a server restart is its own logic                          | Accepted                                                              |

## Writing a record

Create `decisions/NNNN-short-title.md` with the next free number, and add it to the table above:

```markdown
# NNNN. <Decision, stated as a short phrase>

Status: Proposed | Accepted | Superseded by [NNNN](NNNN-title.md)
Date: YYYY-MM-DD

## Context

The situation and forces that made a decision necessary.

## Decision

What was decided, in a few sentences.

## Alternatives considered

Each serious alternative, and why it wasn't chosen.

## Consequences

What follows, good and bad, including what becomes harder.
```
