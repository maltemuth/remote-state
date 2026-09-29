# Socket.IO events

The Socket.IO server shares the HTTP server's port and uses the default `/socket.io` path. It's enabled unless `serverConfiguration.socketIO.enabled` is `false`.

A socket belongs to exactly one player in one game. Clients only receive events; the server doesn't handle any events sent by clients.

## Connecting

Pass credentials in the handshake `auth` object:

| Field | Required | Description |
|---|---|---|
| `gameId` | yes | Game to connect to |
| `token` | yes | The player's token for that game |
| `playerId` | no | If present, it must match the token's player |

```js
const socket = io("http://localhost:3000", { auth: { gameId, token } });
```

If authentication fails, the connection is refused and the client receives `connect_error` with one of these messages:

| `error.message` | Cause |
|---|---|
| `Invalid player or game` | Unknown token, token from another game, or mismatched `playerId` |
| `Failed to authenticate` | Error while checking credentials |

A player may have several sockets open at once, for example in several tabs. Each receives all events for that player.

## Server events

### game-state-update

Sent to every connected player of a game after an action is accepted. Each player receives their own filtered view.

```ts
{
  gameId: string;
  stateId: string;
  sequence: number;       // same meaning as in GET state
  state: PlayerStateType; // filterStateForPlayer(newState, playerId), or the full state
}
```

Updates are only sent to sockets that are connected at the time. A client that reconnects should fetch `GET /api/games/:gameId/state/current` to catch up. Comparing `sequence` with the last one seen tells a client whether it missed any updates.

### player-joined

```ts
{ playerId: string; playerName: string }
```

This event is sent in two situations:

- to all sockets of the game when a player registers through `POST /api/games/:gameId/players`
- to the other sockets of the game when a player's socket connects

### player-left

```ts
{ playerId: string }
```

Sent to the other sockets of the game when one of a player's sockets disconnects.

### Custom events

The server application can send its own events through `server.socketIOManager`. See [Server API](server-api.md#socketmanager).
