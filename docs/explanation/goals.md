# Goals

Remote State exists so that multiplayer games can keep their rules on a server, while their clients work with game state the way they already work with application state. It has two goals.

## 1. Clients dispatch actions; the server runs the game

A client doesn't change game state itself. It dispatches an action, the server applies the game's rules to it, and every player receives the resulting state, as much of it as they may see.

Game developers supply only the rules: how a game starts, which actions are legal, what an action does, and what each player may see. The library provides everything else: transport, identity, persistence, ordering, and delivering updates.

The server exists today; see [Architecture](architecture.md).

## 2. Clients use the state in their own state library

On the client, game state should arrive in whatever state-management library the application already uses, such as Redux or one of its alternatives, through a custom middleware. For the application, a game action is dispatched like any other action. The middleware sends it to the server, and puts the server's updates into the store.

The client side doesn't exist yet. Today every client talks to the HTTP API and Socket.IO directly; see [Connect a browser client](../how-to/connect-a-client.md) and the [Client package](designs/client-package.md) proposal.

## What follows from these goals

- **Actions are shared by client and server.** An action has to make sense both as something the client's store dispatches and as input to the server's rules. That argues for the conventional Redux action shape, a `type` plus data.
- **How updates arrive shapes the client.** How the server sends new state, whether as full snapshots or as changes, decides what the middleware dispatches into the store. See [State synchronization](designs/state-synchronization.md).
- **No single client framework.** The middleware must fit several state libraries, which argues for a framework-independent core with small adapters.
- **Types should be shared.** A game's state, action and player-view types are the contract between its server and its clients.
