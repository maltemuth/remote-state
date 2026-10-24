# Client API

`@malte.muth/remote-state-client` keeps one member's view of a space in step with the server and sends the member's actions. It works in browsers and in Node.js 24, and doesn't depend on a state library ([0043](../explanation/decisions/0043-client-core-without-state-library.md)).

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
  baseUrl?: string; // where the space's library routes are mounted
}

interface Session {
  spaceId: string;
  memberId: string;
  token: string;
}
```

Exchanges an admission code from the host for a session, through [`POST /api/tokens`](http-api.md#post-apitokens). A code works once, within a minute.

| Failure                       | Throws                                          |
| ----------------------------- | ----------------------------------------------- |
| Used, expired or unknown code | `RequestError` with `status` 401                |
| The rules refused the member  | `RequestError` with `status` 403 and its reason |

The server can't hand out the token again. Keep the session, for example in `sessionStorage`, to reconnect later.

## createClient

```ts
createClient<View = unknown, Action = unknown>(options: ClientOptions): RemoteStateClient<View, Action>
```

Connects to the space right away. `View` is what the member sees, as returned by the rules' `view`, and `Action` is what the rules accept. Neither is checked at runtime ([0045](../explanation/decisions/0045-client-generic-over-game-types.md)).

### ClientOptions

| Option        | Default                               | Meaning                                                                                                                                                                                                                              |
| ------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `session`     | required                              | From `redeemCode`                                                                                                                                                                                                                    |
| `baseUrl`     | the page's origin                     | Where the space's library routes are mounted, such as `/tic-tac-toe` or `https://spaces.example.com/tic-tac-toe`                                                                                                                     |
| `socketPath`  | `<baseUrl's path>/socket.io`          | The socket's path, if the host set another                                                                                                                                                                                           |
| `format`      | `"immer"`                             | What the socket sends: `"immer"` patches, which the client applies, or whole views as `"state"`                                                                                                                                      |
| `onError`     | ignore                                | Called with errors the client can't report elsewhere, such as a failed catch-up, or a `ChecksumError`                                                                                                                                |
| `parser`      | JSON                                  | Socket.IO's parser, when the server uses another, such as `socket.io-msgpack-parser`                                                                                                                                                 |
| `resumeAfter` | 10,000                                | In a browser, reconnect at once when the page is shown again after being hidden this many milliseconds, or the network comes back; `null` never ([0062](../explanation/decisions/0062-the-client-reconnects-when-a-page-resumes.md)) |
| `page`        | the browser's `document` and `window` | The page to watch for that, as `{ document, window }`; for tests outside a browser                                                                                                                                                   |

Outside a browser, `baseUrl` must be an absolute URL.

## RemoteStateClient

| Member                   | Description                                                                                                                                                                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `session`                | The session it was created with                                                                                                                                                                                                                        |
| `getSnapshot()`          | The latest `{ sequence, view }`, or `null` before the first view arrived                                                                                                                                                                               |
| `subscribe(listener)`    | Calls `listener` with every new snapshot. Returns a function that unsubscribes                                                                                                                                                                         |
| `waitFor(sequence)`      | Resolves with the snapshot once the view has reached `sequence`. Rejects after `close()` or a refused connection, since no more views can come                                                                                                         |
| `dispatch(action)`       | Sends an action. Resolves with `{ sequence }` of the state it produced                                                                                                                                                                                 |
| `getConnection()`        | The connection's state; see below                                                                                                                                                                                                                      |
| `onConnection(listener)` | Calls `listener` whenever the connection's state changes. Returns a function that unsubscribes                                                                                                                                                         |
| `close()`                | Disconnects for good. Subscribers aren't called anymore                                                                                                                                                                                                |
| `reconnect()`            | Drops the connection and connects again at once, for a fresh whole view. The client does it by itself when a page resumes ([0062](../explanation/decisions/0062-the-client-reconnects-when-a-page-resumes.md))                                         |
| `pairingCode()`          | Resolves with a single-use code for this member, for another device to redeem with `redeemCode` and follow the space as the same member. Needs a server with `devicePairing` ([0063](../explanation/decisions/0063-players-pair-their-own-devices.md)) |

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
- **Sequences only increase, until the server goes back.** Updates at or before the current sequence are ignored, except the whole view sent on every (re)connect, and a whole view fetched while catching up: those replace the view even at a lower sequence, since a restarted server may have gone back to an earlier state ([0055](../explanation/decisions/0055-the-view-on-connect-replaces-the-clients.md)).
- **After a gap,** or patches that don't apply, the client catches up with [`GET …/updates`](http-api.md#get-apispacesspaceidupdates), or with the whole state when the server can't build a patch. Updates that arrive meanwhile are applied afterwards. If catching up fails, the error goes to `onError`. Whole views that arrived meanwhile still apply, and the next update tries again.

### dispatch

`dispatch` doesn't change the view. The new view arrives through `subscribe`, like every other member's; `waitFor` with the returned `sequence` waits for it ([0033](../explanation/decisions/0033-no-optimistic-updates.md)).

| Failure                       | Throws                                                                 |
| ----------------------------- | ---------------------------------------------------------------------- |
| The rules rejected the action | `ActionRejectedError`; `message` is the rules' reason, `status` is 400 |
| Invalid token                 | `RequestError` with `status` 401                                       |
| Server error                  | `RequestError` with `status` 500                                       |

### Connection states

```ts
type ConnectionState =
  | { status: "connecting"; error?: string }
  | { status: "connected" }
  | { status: "disconnected"; reason: string }
  | { status: "refused"; error: string };
```

| Status         | Meaning                                                                                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `connecting`   | Connecting for the first time, or reconnecting. `error` is the last attempt's error, if any                                                                         |
| `connected`    | Connected. Every (re)connect starts with the whole view                                                                                                             |
| `disconnected` | The connection was lost. Socket.IO reconnects by itself, unless the client was closed or the server disconnected it; so does `reconnect()`, and a page that resumes |
| `refused`      | The server refused the connection, for example for an invalid token or space. No more attempts                                                                      |

## Errors

```ts
class RequestError extends Error {
  readonly status: number;
}
class ActionRejectedError extends RequestError {}
class ChecksumError extends Error {
  readonly sequence: number;
}
```

`message` is the server's `error`, or the HTTP status text if there's none.

A `ChecksumError` goes to `onError` when patches didn't lead to a view with their checksum. The client has already fetched the whole view by then ([0059](../explanation/decisions/0059-checksums-with-patches.md)).
