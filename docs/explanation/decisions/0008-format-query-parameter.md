# 0008. The update format is chosen with a `format` query parameter

Status: Accepted for the socket; superseded for GET by [0009](0009-separate-state-and-update-endpoints.md); its values are reduced to `state` and `immer` by [0014](0014-immer-patches-only-external-format.md)
Date: 2026-09-29

## Context

Clients choose the format of the state they receive ([0007](0007-client-chosen-update-format.md)), both for their socket subscription and on GET endpoints. They need a way to state that choice.

## Decision

The choice is a query parameter named `format`, the same for both channels:

- on GET endpoints that return state, for example `GET /api/games/:gameId/state/current?format=json-patch`
- in the Socket.IO handshake, through the client's `query` option: `io(url, { auth, query: { format: "json-patch" } })`

Its values are:

| Value | Format |
|---|---|
| `state` | The player's whole view. This is the default when the parameter is missing. |
| `json-patch` | JSON Patch (RFC 6902) |
| `immer` | Immer patches |

## Alternatives considered

- **HTTP content negotiation** through the `Accept` header. It's the standard HTTP mechanism, and JSON Patch has a registered media type, `application/json-patch+json`. But Immer's format has no media type, and a socket handshake has no `Accept` header, so the two channels would need different mechanisms.

## Consequences

- The same parameter works on both channels, and is easy to set from any client, and to see in logs and in a browser.
- Defaulting to `state` keeps existing clients working unchanged.
- An unknown value, or a patch format the game doesn't offer, must be rejected clearly: with status 400 on GET, and a `connect_error` on the socket. Whether the server should instead fall back to `state` is left to the [proposal](../designs/state-synchronization.md).
