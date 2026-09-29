# 0009. Separate GET endpoints for whole state and for updates

Status: Accepted; the updates endpoint's `format` parameter is dropped by [0014](0014-immer-patches-only-external-format.md)
Date: 2026-09-29

## Context

Clients choose whether they receive whole states or patches ([0007](0007-client-chosen-update-format.md)), and [0008](0008-format-query-parameter.md) put that choice in a `format` query parameter on both channels. For GET, one endpoint serving both kinds would behave very differently depending on a parameter: one current state, or a list of updates relative to an earlier state. The existing endpoint, `GET /api/games/:gameId/state/:cursor`, already has a `:cursor` segment that is ignored.

## Decision

GET has two endpoints, one for each kind of answer:

- **Whole state:** `GET /api/games/:gameId/state` returns the player's current view and its `sequence`. It takes no format parameter.
- **Updates:** `GET /api/games/:gameId/updates?since=<sequence>&format=<json-patch|immer>` returns the updates after `since`, as patches in the chosen format.

The socket keeps the `format` handshake parameter from 0008, with all three values, since a subscription can carry either kind.

## Alternatives considered

- **One endpoint with a `format` parameter,** as in 0008. One URL, but its response shape would depend on the parameter, which is harder to document, type and cache.

## Consequences

- Each endpoint has one response shape.
- The cursor becomes an explicit `since` parameter on the updates endpoint. `GET …/state/:cursor` is replaced by `GET …/state`, which is a breaking change for existing clients.
- The updates endpoint needs the recorded patches of each state to be stored (see 0007).
- Still open in the [proposal](../designs/state-synchronization.md): how the updates endpoint answers when `since` is too old, or when the game doesn't offer patches; for example, by pointing the client to the whole-state endpoint.
