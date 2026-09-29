# 0014. Immer's patch format is the only external patch format

Status: Accepted for now; to be revisited when clients outside the client package need patches
Date: 2026-09-29

## Context

Clients could choose between whole states, JSON Patch and Immer's patches ([0007](0007-client-chosen-update-format.md)). Immer's patches use the same operations as JSON Patch, but give each path as an array (`["board", 4, 4]`) rather than a string (`/board/4/4`).

The client package will apply patches with Immer, because Immer applies them the way Redux-style stores need: changed parts become new objects, and unchanged parts keep their identity ([Client package](../designs/client-package.md)). A JSON Patch arriving there would only be converted to Immer's format before being applied.

## Decision

The only external patch format is Immer's. Clients choose between:

- **`state`:** the player's whole view
- **`immer`:** patches in Immer's format

The server computes diffs with `rfc6902` ([0011](0011-patches-are-diffs-of-views.md)), converts their paths to arrays, and stores and sends them in Immer's format. Full-state diffs ([0013](0013-store-full-state-diffs.md)) are stored in the same format, for consistency.

## Alternatives considered

- **Offering JSON Patch as well,** as decided in 0007. It serves clients that use standard JSON Patch tools, but no planned client needs it, and it doubles what the server must offer, test and document.

## Consequences

- The socket's `format` handshake parameter takes `state` or `immer` ([0008](0008-format-query-parameter.md)).
- `GET …/updates` needs no `format` parameter, since there's only one patch format ([0009](0009-separate-state-and-update-endpoints.md)).
- Stored player diffs ([0012](0012-store-player-diffs.md)) are in Immer's format, converted once when stored, so reading and sending them needs no conversion.
- The client package applies received patches directly, with no path conversion.
- Clients that don't use the client package don't need Immer: its patches are plain JSON. To use a JSON Patch library instead, they convert each path array to a string.
- JSON Patch could be added back later as a conversion when sending, without changing what's stored.
