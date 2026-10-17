# Client package

Status: Core decided in [0043](../decisions/0043-client-core-without-state-library.md), [0044](../decisions/0044-client-hands-out-whole-views.md) and [0045](../decisions/0045-client-generic-over-game-types.md); adapters and lifecycle events open

## Outcome

The package starts as a core without a state library (0043). It keeps the player's whole view, which anything can subscribe to; it receives patches, applies them with Immer, and catches up by `sequence` after gaps (0044). It takes the game's view and action types as type parameters (0045). It doesn't update optimistically ([0033](../decisions/0033-no-optimistic-updates.md)).

The synchronization protocol it needs was decided in 0029–0036, and [Player information](player-information.md) is decided. Events from [Game lifecycle](game-lifecycle.md), which is still open, and adapters for state libraries are added later.

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

## Why it was deferred

The client's interface follows from decisions that are still open:

- **The events it exposes** depend on [Game lifecycle](game-lifecycle.md) and [Player information](player-information.md).
- **Its synchronization protocol** is the subject of [State synchronization](state-synchronization.md).

## Known requirements

Some requirements already follow from decisions made elsewhere.

**Applying patches.** Clients may receive patches instead of whole states ([0007](../decisions/0007-client-chosen-update-format.md)). The client package must apply them in a way that works for Redux-style stores, which detect changes by object identity: every changed part must become a new object, and every unchanged part must stay the same object. Tested:

- **`rfc6902`'s `applyPatch`** changes the target in place. The root and every changed object stay the same objects, so an identity-based store sees no change and doesn't re-render. On frozen state, which Redux Toolkit uses in development, it throws.
- **Immer's `applyPatches`** returns a new state with structural sharing: the root and the changed parts are new, the unchanged parts keep their identity, the original stays untouched, and frozen state works.

So the client package applies patches with Immer. Since Immer's format is the only external patch format ([0014](../decisions/0014-immer-patches-only-external-format.md)), it applies them directly, with no conversion. The server computes diffs in Immer's format, with its own diff or `rfc6902` ([0057](../decisions/0057-own-diff-arrays-by-position.md), [0058](../decisions/0058-rfc6902-kept-as-reference-and-option.md)). Immer is a dependency of the client package, not something clients must use: the patches are plain JSON.

## Questions to answer when it's taken up

- Which state libraries must be supported first, and does each have a middleware concept the package can hook into?
- What does the middleware dispatch into the store when an update arrives: a full replacement of the game state, or changes to apply?
- Should the client apply an action optimistically before the server confirms it, and roll it back if the server rejects it?
- Should there be a framework-independent core, with thin adapters for Redux and its alternatives?
- How does a client share the game's TypeScript types (state, actions, player view) with the server?
- How does the client resynchronize after missed updates: by `sequence`, by cursor, or by refetching?
