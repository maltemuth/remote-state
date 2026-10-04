# 0043. The client package starts as a core without a state library

Status: Accepted
Date: 2026-10-04

## Context

The project's second [goal](../goals.md) is that clients use game state in their own state library. Every client currently repeats the same work by hand: exchanging a code for a token, sending actions, connecting the socket, applying updates and catching up ([Client package](../designs/client-package.md)). State libraries differ in how they take outside data: Redux through middleware and dispatched actions, others through stores that can be subscribed to, React through `useSyncExternalStore`.

## Decision

A new package, `@malte.muth/remote-state-client`, starts with a core that doesn't depend on any state library. It keeps the player's current view, lets anything subscribe to it, and sends actions. Adapters for particular state libraries, such as Redux, come later as thin layers on top of the core.

The client doesn't apply actions optimistically; it shows a result once the server has sent it ([0033](0033-no-optimistic-updates.md)).

## Alternatives considered

- **Redux middleware first.** Ties the first version to one library, while the core it needs is the same for all of them.
- **Only documenting the steps,** as [Connect a browser client](../../how-to/connect-a-client.md) does. Leaves every client to get catching up and ordering right on its own.

## Consequences

- The core works in browsers and in Node.js, and in applications without a state library.
- A store, or React's `useSyncExternalStore`, can take the core's `subscribe` and `getSnapshot` directly.
- Which adapters come first is decided when they're needed.
