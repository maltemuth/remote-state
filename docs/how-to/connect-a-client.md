# Connect a browser client

This guide shows how to connect a web page to a Remote State game with the client package, `@malte.muth/remote-state-client`: getting a session, showing the player's view, and sending actions. [public/client.js](../../packages/remote-state-example-server/public/client.js) in the example server is a complete working version. For every option, see the [Client API](../reference/client-api.md).

The paths here assume the library's routes are at the root of your server, as with `createRemoteStateServer`. If your host mounts them under a prefix, pass it as `baseUrl`; the example server serves tic-tac-toe under `/tic-tac-toe`.

## 1. Load the client package

With a bundler, install it:

```sh
npm install @malte.muth/remote-state-client
```

Without a bundler, serve the package and its two dependencies as ES modules, and map their names with an import map:

```html
<script type="importmap">
  {
    "imports": {
      "@malte.muth/remote-state-client": "/modules/remote-state-client/index.js",
      "immer": "/modules/immer.mjs",
      "socket.io-client": "/modules/socket.io-client.mjs"
    }
  }
</script>
<script type="module" src="client.js"></script>
```

The paths are the host's choice. The example server serves them from the installed packages: the client's `dist` directory, `immer/dist/immer.production.mjs`, and `socket.io-client/dist/socket.io.esm.min.js`. See [src/host/browserModules.ts](../../packages/remote-state-example-server/src/host/browserModules.ts).

## 2. Get a code from your host

The library has no endpoint for creating or joining games. Your host app has its own, which return an admission code; see [Create games and admit players](admit-players.md). With a lobby like the example server's:

```js
const lobby = async (path, body = {}) => {
  const response = await fetch(`/lobby${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return response.json();
};

const { gameId } = await lobby("/games"); // only to create a new game
const { code } = await lobby(`/games/${gameId}/codes`, { name });
```

## 3. Exchange the code for a session

Exchange the code right away; it's valid for one minute and works once:

```js
import { redeemCode } from "@malte.muth/remote-state-client";

const session = await redeemCode(code); // { gameId, playerId, token }
sessionStorage.setItem(`game:${session.gameId}`, JSON.stringify(session));
```

If the game refuses the player, for example because it's full, this throws a `RequestError` with `status` 403 and the game's reason as `message`. A used or expired code fails with 401.

`sessionStorage` keeps one identity per tab, which lets you play both sides in two tabs while testing. Use `localStorage` to survive browser restarts instead. The server can't hand out the token again; if the host admits the same identity again, the player gets their player back with a new session.

## 4. Show the player's view

```js
import { createClient } from "@malte.muth/remote-state-client";

const client = createClient({ session });

client.subscribe(({ view }) => render(view));
client.onConnection((connection) => showConnection(connection.status));
```

The client connects right away. It receives the player's whole view, then every change, and catches up by itself after reconnects and missed updates. `render` gets a new view for every change. Unchanged parts of it are the same objects as before, and views are frozen.

To use it in React, `getSnapshot` and `subscribe` fit `useSyncExternalStore`:

```js
const snapshot = useSyncExternalStore(client.subscribe, client.getSnapshot);
```

## 5. Send actions

```js
import { ActionRejectedError } from "@malte.muth/remote-state-client";

try {
  await client.send({ type: "place", row: 1, col: 1 });
} catch (error) {
  if (error instanceof ActionRejectedError) showError(error.message);
  else throw error;
}
```

`send` resolves with the `sequence` of the state the action produced. The new view arrives through `subscribe`, as for every other player; show the result then, not before ([0033](../explanation/decisions/0033-no-optimistic-updates.md)). To wait for it, use `await client.waitFor(sequence)`.

A rejected action throws an `ActionRejectedError`, whose `message` is the game's reason, such as `"It's not your turn"`.

## Use the game's types

In TypeScript, pass the game's view and action types, so `render` and `send` are checked:

```ts
import type { TicTacToeAction, TicTacToeView } from "my-game/types";

const client = createClient<TicTacToeView, TicTacToeAction>({ session });
```

Keep the types in a module the client can import without importing the server.

## Clients on another origin

Pass the full URL as `baseUrl`, for example `createClient({ session, baseUrl: "https://games.example.com/tic-tac-toe" })`, and to `redeemCode`. By default, the library's API and socket allow requests from any origin; to limit them, set the server's [`cors` option](../reference/server-api.md#options). Your own routes, such as a lobby, need their own CORS.

## Without the client package

Clients in other languages, or that don't want the package, talk to the [HTTP API](../reference/http-api.md) and the [Socket.IO events](../reference/socket-events.md) directly:

1. `POST /api/tokens` with the code, for the token.
2. Connect Socket.IO with `auth: { gameId, token }`, and optionally `query: { format: "immer" }`. Every (re)connect starts with a whole `state` event, followed by a `state` or `patches` event for every change, each with a `sequence`.
3. `POST /api/games/:gameId/actions` with `{ action }` and `Authorization: Bearer <token>`. It answers 201 with `{ sequence }`, or 400 with the game's reason.
4. After missing updates, `GET /api/games/:gameId/updates?since=<sequence>` returns one set of patches, or redirects to the whole state.
