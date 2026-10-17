# 0044. The client hands out whole views and catches up by sequence

Status: Accepted, refined by [0055](0055-the-view-on-connect-replaces-the-clients.md): a whole view on connect replaces the client's
Date: 2026-10-04

## Context

The socket sends either whole views or Immer patches ([0014](0014-immer-patches-only-external-format.md)), each with a `sequence` ([0029](0029-sequence-is-the-cursor.md)). Stores that detect changes by object identity need changed parts to be new objects and unchanged parts to keep their identity, which applying patches with Immer provides ([Client package](../designs/client-package.md)). A client can miss updates, and the server lets it catch up in one jump from the sequence it has ([0030](0030-updates-in-one-jump.md)).

## Decision

Subscribers receive the player's whole view together with its `sequence`. The core receives patches by default, applies them with Immer, and hands out the result; a whole view from the server replaces the current one. Other events, such as the connection's status, are separate from views, and more can be added later.

The core keeps the sequence of its view:

- Anything at or before it is ignored.
- Patches for the next sequence are applied.
- After a gap, or patches that don't apply, it catches up with `GET …/updates?since=`, or with the whole state when the server sends one instead. Updates that arrive meanwhile are applied afterwards, if they're still newer.
- Every (re)connect starts with a whole view ([0031](0031-socket-sends-state-on-connect.md)).

## Alternatives considered

- **Handing patches to the state library.** Every adapter would have to apply them correctly, and subscribers without a library couldn't use them.
- **Whole views over the socket only.** Simpler, but sends the whole view for every change.

## Consequences

- Subscribers never deal with patches or the update format, so the format can change without affecting them.
- Unchanged parts of a view keep their identity across updates.
- Immer is a dependency of the client package, but not of applications using it.
