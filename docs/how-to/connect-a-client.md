# Connect a browser client

This guide shows how to connect a web page to a Remote State game: registering a player, sending actions, and staying in sync. [public/index.html](../../packages/remote-state-example-server/public/index.html) in the example server is a complete working version of the same steps.

## 1. Get a token

The player who creates the game uses `POST /api/games`. Everyone else registers with `POST /api/games/:gameId/players`. Both responses contain `token` and `playerId`. Store them for the rest of the session:

```js
const registration = await fetch(`/api/games/${gameId}/players`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ playerName }),
}).then((response) => response.json());

sessionStorage.setItem(`game:${gameId}`, JSON.stringify(registration));
```

`sessionStorage` keeps one identity per tab, which lets you play both sides in two tabs while testing. Use `localStorage` to survive browser restarts instead.

The token is the only credential, and it can't be reissued. If it's lost, the player has to register again as a new player.

## 2. Send actions over HTTP

```js
async function sendAction(action) {
  const response = await fetch(`/api/games/${gameId}/actions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error); // e.g. the validateAction message
  return body; // the new state, as this player sees it
}
```

Render the returned state straight away. The same state also arrives over the socket, so rendering has to be idempotent.

## 3. Receive updates over Socket.IO

The server serves the client library at `/socket.io/socket.io.js`:

```html
<script src="/socket.io/socket.io.js"></script>
```

```js
const socket = io({ auth: { gameId, token } });

socket.on("game-state-update", (update) => render(update.state));
socket.on("connect_error", (error) => showError(error.message));
```

## 4. Catch up after connecting

Updates sent while a client is disconnected are not replayed. Fetch the current state whenever the socket connects, which includes reconnects:

```js
socket.on("connect", async () => {
  const current = await fetch(`/api/games/${gameId}/state/current`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((response) => response.json());
  render(current.state);
});
```

To ignore late or duplicate updates, keep the highest `sequence` you've rendered and skip anything older.

## Serving the client from the game server

See [Serve a web client](serve-a-web-client.md).

## Clients on another origin

HTTP CORS is open to all origins. For Socket.IO, set `serverConfiguration.socketIO.cors` (see [Server API](../reference/server-api.md#remotestateserverconfiguration)) and connect with the full URL: `io("https://games.example.com", { auth })`.
