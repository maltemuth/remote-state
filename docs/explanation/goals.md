# Goals

Remote State lets shared state, such as a multiplayer game, keep its rules on a server, while clients treat it like any other application state.

1. **Clients dispatch actions; the server runs the rules.** A client never changes the shared state itself. The server applies the rules, and every member receives the result, as much as they may see. Developers supply only the rules; the library does transport, identity, storage, ordering and delivery. This exists: see [Architecture](architecture.md).
2. **Clients use the state in their own state library,** such as Redux, through a middleware. The client package is the core of that: it keeps a member's view in step, for any library to subscribe to ([Client API](../reference/client-api.md)). Adapters for particular libraries don't exist yet ([Client package](designs/client-package.md)).

What follows:

- **Actions have the conventional shape,** a `type` plus data, since both the client's store and the server's rules take them.
- **How updates arrive shapes the client:** whole views or patches decide what the middleware dispatches ([State synchronization](designs/state-synchronization.md)).
- **The client core is framework-independent,** with small adapters on top.
- **The rules' state, action and view types are the contract** between the server and its clients.
