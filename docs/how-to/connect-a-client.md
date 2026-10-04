# Connect a browser client

This guide shows how to connect a web page to a Remote State game: getting a token, receiving the state, and sending actions. [public/client.js](../../packages/remote-state-example-server/public/client.js) in the example server is a complete working version of the same steps.

The paths here assume the library's routes are at the root of your server, as with `createRemoteStateServer`. If your host mounts them under a prefix, put it in front of every path, and connect the socket at its path (see step 3). The example server serves tic-tac-toe under `/tic-tac-toe`, so its client sends requests to `/tic-tac-toe/api/…`.

## 1. Get a code from your host

The library has no endpoint for creating or joining games. Your host app has its own, which return an admission code; see [Create games and admit players](admit-players.md). With a lobby like the example server's, which it serves at `/tic-tac-toe/lobby` for tic-tac-toe:

```js
const { gameId } = await post("/lobby/games"); // only to create a new game
const { code } = await post(`/lobby/games/${gameId}/codes`, { name });
```

`post` here is a small helper:

```js
async function post(path, body, token) {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body && JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error);
  return data;
}
```

## 2. Exchange the code for a token

Exchange the code right away; it's valid for one minute and works once:

```js
const session = await post("/api/tokens", { code }); // { gameId, playerId, token }
sessionStorage.setItem(`game:${gameId}`, JSON.stringify(session));
```

If the game refuses the player, for example because it's full, this fails with status 403 and the game's reason as `error`. A used or expired code fails with 401.

`sessionStorage` keeps one identity per tab, which lets you play both sides in two tabs while testing. Use `localStorage` to survive browser restarts instead.

The token is the player's credential. The library can't hand it out again. Whether a player can get a new token depends on the host: if it admits the same identity again, the player gets their player back with a new token.

## 3. Receive the state over Socket.IO

The server serves the client library at `/socket.io/socket.io.js`:

```html
<script src="/socket.io/socket.io.js"></script>
```

```js
const socket = io({ auth: { gameId, token: session.token } });

socket.on("state", (event) => render(event.state));
socket.on("connect_error", (error) => showError(error.message));
```

If the server sets another socket path, such as `/tic-tac-toe/socket.io` in the example, load the script from that path and pass it to `io`: `io({ path: "/tic-tac-toe/socket.io", auth })`.

The socket sends the player's whole view as soon as it connects, and again after every reconnect, then a `state` event for every change. There's no separate catch-up step.

Each event carries a `sequence`. To ignore anything older than what you've rendered, keep the highest one you've seen.

## 4. Send actions over HTTP

```js
async function sendAction(action) {
  const { sequence } = await post(
    `/api/games/${gameId}/actions`,
    { action },
    session.token,
  );
  return sequence; // the state this action produced
}
```

An accepted action answers 201 with the `sequence` of the state it produced. The state itself arrives over the socket, as for every other player. Wait for it before showing the result ([0033](../explanation/decisions/0033-no-optimistic-updates.md)).

A rejected action fails with 400, and `error` is the game's message, such as `"It's not your turn"`.

## Receive patches instead of whole states

To receive only what changed, connect with `format: "immer"` and apply the patches with [Immer](https://immerjs.github.io/immer/patches):

```js
import { applyPatches, enablePatches } from "immer";

enablePatches();

let view = null;
const socket = io({
  auth: { gameId, token: session.token },
  query: { format: "immer" },
});

// Sent on every (re)connect, also in this format
socket.on("state", (event) => {
  view = event.state;
  render(view);
});
socket.on("patches", (event) => {
  view = applyPatches(view, event.patches);
  render(view);
});
```

Each `patches` event applies to the view at the `sequence` before it. Events arrive in order, and every reconnect starts again with a whole `state`.

## Catch up without a socket

A client that isn't connected, or polls, can ask what changed since the `sequence` it has:

```js
const response = await fetch(`/api/games/${gameId}/updates?since=${sequence}`, {
  headers: { Authorization: `Bearer ${session.token}` },
});
const { sequence: latest, patches } = await response.json();
```

The response is one set of patches up to the latest state. When no patch can be built, the server redirects to `GET …/state`, and `fetch` follows the redirect, so the body is a whole state instead: check for `state` in it. A `since` the player can't have had answers 404. See [HTTP API](../reference/http-api.md#get-apigamesgameidupdates).

## Serving the client from the game server

See [Serve a web client](serve-a-web-client.md).

## Clients on another origin

By default, the library's API and socket allow requests from any origin. To limit them, set the server's [`cors` option](../reference/server-api.md#options), such as `{ origin: "https://my-game.example.com" }`. Your own routes, such as a lobby, need their own CORS. Use full URLs in the client, and connect with `io("https://games.example.com", { auth })`.
