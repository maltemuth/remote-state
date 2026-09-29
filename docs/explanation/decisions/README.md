# Decisions

Records of design decisions: what was decided, in what context, and what was rejected. They explain why the project is the way it is. For how it currently behaves, see the [reference](../../reference/) and [Architecture](../architecture.md).

Records aren't edited after the fact, except to update their status. A decision that changes gets a new record, and the old one is marked as superseded.

| # | Decision | Status |
|---|---|---|
| [0001](0001-http-actions-socket-updates.md) | Actions over HTTP, updates over Socket.IO | Accepted |
| [0002](0002-node-24.md) | Require Node.js 24 | Accepted |
| [0003](0003-no-known-vulnerabilities.md) | Ship with no known dependency vulnerabilities | Accepted |
| [0004](0004-esm-with-jest.md) | ESM throughout, tested with Jest | Accepted |
| [0005](0005-mikro-orm.md) | MikroORM with standard decorators for the data layer | Accepted |
| [0006](0006-single-process.md) | Run as a single process for now | Accepted |
| [0007](0007-client-chosen-update-format.md) | Clients choose the format of state updates | Accepted, refined by 0009 and 0014 |
| [0008](0008-format-query-parameter.md) | The update format is chosen with a `format` query parameter | Accepted for the socket (values per 0014), superseded for GET by 0009 |
| [0009](0009-separate-state-and-update-endpoints.md) | Separate GET endpoints for whole state and for updates | Accepted |
| [0010](0010-every-game-has-hidden-information.md) | Every game is treated as a game with hidden information | Accepted, refined by 0024 |
| [0011](0011-patches-are-diffs-of-views.md) | Patches are diffs of player views; only full states are stored | Accepted, storage extended by 0012, views per audience by 0024 |
| [0012](0012-store-player-diffs.md) | Store each player's diffs alongside the full states | Accepted, superseded in part by 0024 |
| [0013](0013-store-full-state-diffs.md) | Also store diffs of the full state | Accepted |
| [0014](0014-immer-patches-only-external-format.md) | Immer's patch format is the only external patch format | Accepted for now |
| [0015](0015-library-issues-opaque-tokens.md) | The library issues its own opaque tokens | Accepted |
| [0016](0016-authentication-in-library-authorization-by-implementer.md) | The library authenticates; implementers authorize | Accepted |
| [0017](0017-hashed-tokens-in-header-and-handshake.md) | Tokens are stored hashed, and accepted only in the header and the handshake | Accepted |
| [0018](0018-no-token-expiration-or-revocation.md) | Tokens don't expire and can't be revoked | Accepted for now |
| [0019](0019-several-tokens-per-player.md) | A player can have several tokens | Accepted |
| [0020](0020-hosts-admit-players-through-codes.md) | Hosts admit players through single-use codes | Accepted |
| [0021](0021-games-created-with-creategame.md) | Hosts create games with `createGame`, separately from admitting players | Accepted |
| [0022](0022-roles-belong-to-game-state.md) | Roles belong to the game's state and rules | Accepted |
| [0023](0023-no-server-to-server-admit.md) | `admit` is only called in-process | Accepted |
| [0024](0024-views-per-audience.md) | Views are computed per audience | Accepted |
| [0025](0025-default-audiences.md) | Default audiences depend on whether the game filters views | Accepted |

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
