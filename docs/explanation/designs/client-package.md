# Client package

Status: Deferred until [Player information](player-information.md), [Game lifecycle](game-lifecycle.md) and the synchronization protocol are decided

## Problem

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
- **Its synchronization protocol** depends on whether clients keep receiving full states, or move to cursors and deltas. That was part of the original plan; the `:cursor` parameter of `GET …/state/:cursor` is still ignored today (see [Known limitations](../limitations.md)).

## Questions to answer when it's taken up

- Should there be a framework-independent core, with thin adapters for Redux, React or others?
- How does a client share the game's TypeScript types (state, actions, player view) with the server?
- How does the client resynchronize after missed updates: by `sequence`, by cursor, or by refetching?
