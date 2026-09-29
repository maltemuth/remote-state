# Client package

Status: Deferred until [State synchronization](state-synchronization.md), [Player information](player-information.md) and [Game lifecycle](game-lifecycle.md) are decided

## Problem

The second of the project's [goals](../goals.md) is that clients use game state in their own state library, such as Redux or an alternative, through a custom middleware. None of that exists yet.

Every client has to implement the same work itself:

- registering and keeping the token
- sending actions over HTTP
- connecting the socket with the right credentials
- fetching the current state after each reconnect
- ignoring updates that arrive late or twice

[Connect a browser client](../../how-to/connect-a-client.md) documents these steps, and the example tic-tac-toe client implements them by hand.

The original project plan included a client package, `@malte.muth/remote-state-client`, with Redux middleware.

## Why it's deferred

The client's interface follows from decisions that are still open:

- **The events it exposes** depend on [Game lifecycle](game-lifecycle.md) and [Player information](player-information.md).
- **Its synchronization protocol** is the subject of [State synchronization](state-synchronization.md).

## Known requirements

Some requirements already follow from decisions made elsewhere.

**Applying patches.** Clients may receive patches in JSON Patch or Immer's format ([0007](../decisions/0007-client-chosen-update-format.md)). The client package must apply them in a way that works for Redux-style stores, which detect changes by object identity: every changed part must become a new object, and every unchanged part must stay the same object. Tested:

- **`rfc6902`'s `applyPatch`** changes the target in place. The root and every changed object stay the same objects, so an identity-based store sees no change and doesn't re-render. On frozen state, which Redux Toolkit uses in development, it throws.
- **Immer's `applyPatches`** returns a new state with structural sharing: the root and the changed parts are new, the unchanged parts keep their identity, the original stays untouched, and frozen state works.

So the client package applies patches with Immer. For JSON Patch, it first converts each path from its string form (`/board/4/4`) to an array (`["board", 4, 4]`). The server uses `rfc6902` only to compute diffs ([0011](../decisions/0011-patches-are-diffs-of-views.md)). Immer is a dependency of the client package, not part of the protocol: clients that don't use the package can apply JSON Patch with any library.

## Questions to answer when it's taken up

- Which state libraries must be supported first, and does each have a middleware concept the package can hook into?
- What does the middleware dispatch into the store when an update arrives: a full replacement of the game state, or changes to apply?
- Should the client apply an action optimistically before the server confirms it, and roll it back if the server rejects it?
- Should there be a framework-independent core, with thin adapters for Redux and its alternatives?
- How does a client share the game's TypeScript types (state, actions, player view) with the server?
- How does the client resynchronize after missed updates: by `sequence`, by cursor, or by refetching?
