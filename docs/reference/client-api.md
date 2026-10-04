# Client API

`@malte.muth/remote-state-client` keeps one player's view of a game in step with the server and sends the player's actions. It works in browsers and in Node.js 24, and doesn't depend on a state library ([0043](../explanation/decisions/0043-client-core-without-state-library.md)).

```ts
import {
  createClient,
  redeemCode,
  ActionRejectedError,
  RequestError,
} from "@malte.muth/remote-state-client";
```

Its dependencies are `immer` and `socket.io-client`.

## redeemCode

```ts
redeemCode(code: string, options?: RedeemOptions): Promise<Session>

interface RedeemOptions {
  baseUrl?: string; // where the game's library routes are mounted
  fetch?: typeof fetch;
}

interface Session {
  gameId: string;
  playerId: string;
  token: string;
}
```

Exchanges an admission code from the host for a session, through [`POST /api/tokens`](http-api.md#post-apitokens). A code works once, within a minute.

| Failure                       | Throws                                          |
| ----------------------------- | ----------------------------------------------- |
| Used, expired or unknown code | `RequestError` with `status` 401                |
| The game refused the player   | `RequestError` with `status` 403 and its reason |

The server can't hand out the token again. Keep the session, for example in `sessionStorage`, to reconnect later.

## createClient

```ts
createClient<View = unknown, Action = unknown>(options: ClientOptions): RemoteStateClient<View, Action>
```

Connects to the game right away. `View` is what the player sees, as returned by the game's `filterStateForAudience`, and `Action` is what the game accepts. Neither is checked at runtime ([0045](../explanation/decisions/0045-client-generic-over-game-types.md)).

### ClientOptions

| Option       | Default                      | Meaning                                                                                                        |
| ------------ | ---------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `session`    | required                     | From `redeemCode`                                                                                              |
| `baseUrl`    | the page's origin            | Where the game's library routes are mounted, such as `/tic-tac-toe` or `https://games.example.com/tic-tac-toe` |
| `socketPath` | `<baseUrl's path>/socket.io` | The socket's path, if the host set another                                                                     |
| `format`     | `"immer"`                    | What the socket sends: `"immer"` patches, which the client applies, or whole views as `"state"`                |
| `fetch`      | the global `fetch`           | For requests                                                                                                   |
| `onError`    | ignore                       | Called with errors the client can't report elsewhere, such as a failed catch-up                                |

Outside a browser, `baseUrl` must be an absolute URL.

## RemoteStateClient

| Member                   | Description                                                                                    |
| ------------------------ | ---------------------------------------------------------------------------------------------- |
| `session`                | The session it was created with                                                                |
| `getSnapshot()`          | The latest `{ sequence, view }`, or `null` before the first view arrived                       |
| `subscribe(listener)`    | Calls `listener` with every new snapshot. Returns a function that unsubscribes                 |
| `waitFor(sequence)`      | Resolves with the snapshot once the view has reached `sequence`                                |
| `send(action)`           | Sends an action. Resolves with `{ sequence }` of the state it produced                         |
| `getConnection()`        | The connection's state; see below                                                              |
| `onConnection(listener)` | Calls `listener` whenever the connection's state changes. Returns a function that unsubscribes |
| `close()`                | Disconnects for good                                                                           |

`getSnapshot` and `subscribe` fit React's `useSyncExternalStore`, and stores that can subscribe to outside sources.

### Snapshots

```ts
interface Snapshot<View> {
  sequence: number;
  view: View;
}
```

- **Views are frozen.** Copy a view before changing it.
- **Unchanged parts keep their identity** from one snapshot to the next, so stores and components that compare by identity see only what changed ([0044](../explanation/decisions/0044-client-hands-out-whole-views.md)).
- **Sequences only increase.** Updates at or before the current sequence are ignored.
- **After a gap,** or patches that don't apply, the client catches up with [`GET …/updates`](http-api.md#get-apigamesgameidupdates), or with the whole state when the server can't build a patch. Updates that arrive meanwhile are applied afterwards. If catching up fails, the error goes to `onError`, and the next update or reconnect tries again. An added key named `__proto__` is lost when patches are applied; use `format: "state"` for games whose states can have one ([0046](../explanation/decisions/0046-reserved-keys-documented.md)).

### send

`send` doesn't change the view. The new view arrives through `subscribe`, like every other player's; `waitFor` with the returned `sequence` waits for it ([0033](../explanation/decisions/0033-no-optimistic-updates.md)).

| Failure                      | Throws                                                                 |
| ---------------------------- | ---------------------------------------------------------------------- |
| The game rejected the action | `ActionRejectedError`; `message` is the game's reason, `status` is 400 |
| Invalid token                | `RequestError` with `status` 401                                       |
| Server error                 | `RequestError` with `status` 500                                       |

### Connection states

```ts
type ConnectionState =
  | { status: "connecting"; error?: string }
  | { status: "connected" }
  | { status: "disconnected"; reason: string }
  | { status: "refused"; error: string };
```

| Status         | Meaning                                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------------------------- |
| `connecting`   | Connecting for the first time, or reconnecting. `error` is the last attempt's error, if any                         |
| `connected`    | Connected. Every (re)connect starts with the whole view                                                             |
| `disconnected` | The connection was lost. Socket.IO reconnects by itself, unless the client was closed or the server disconnected it |
| `refused`      | The server refused the connection, for example for an invalid token or game. No more attempts                       |

## Errors

```ts
class RequestError extends Error {
  readonly status: number;
}
class ActionRejectedError extends RequestError {}
```

`message` is the server's `error`, or the HTTP status text if there's none.
