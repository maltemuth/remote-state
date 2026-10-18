# Socket.IO events

The Socket.IO server shares the HTTP server's port. Its path is `/socket.io` unless set with the server's [`socket` option](server-api.md#options), and it's enabled unless that option is `false`. With [`createRemoteState`](server-api.md#createremotestate), it's served once the host calls `attach`. CORS for the handshake follows the `cors` option.

A socket belongs to exactly one player in one game. Clients only receive events; the server doesn't handle any events sent by clients.

## Connecting

Pass credentials in the handshake `auth` object:

| Field    | Required | Description                                                                             |
| -------- | -------- | --------------------------------------------------------------------------------------- |
| `gameId` | yes      | Game to connect to                                                                      |
| `token`  | yes      | The player's token for that game, from [`POST /api/tokens`](http-api.md#post-apitokens) |

Choose the update format with the `format` query parameter:

| `format`          | Updates are sent as                         |
| ----------------- | ------------------------------------------- |
| `state` (default) | [`state`](#state) events: the whole view    |
| `immer`           | [`patches`](#patches) events: Immer patches |

```js
const socket = io("http://localhost:3000", {
  auth: { gameId, token },
  query: { format: "immer" }, // optional
  path: "/tic-tac-toe/socket.io", // only if the server sets another path
});
```

If the handshake fails, the connection is refused and the client receives `connect_error` with one of these messages:

| `error.message`                           | Cause                                                 |
| ----------------------------------------- | ----------------------------------------------------- |
| `Unknown format; use one of state, immer` | Any other `format` value                              |
| `Invalid token or game`                   | Missing or unknown token, or a token for another game |
| `Failed to authenticate`                  | Error while checking credentials                      |

A player may have several sockets open at once, for example in several tabs or with several tokens. Each receives all events for that player.

## On connect

Right after connecting, and after every reconnect, the server sends the player's current view as a [`state`](#state) event, in either format ([0031](../explanation/decisions/0031-socket-sends-state-on-connect.md)). Updates follow from the next sequence on, with none missed or repeated in between. This view replaces whatever the client held, even at a lower sequence: a restarted server may have gone back to an earlier state ([0055](../explanation/decisions/0055-the-view-on-connect-replaces-the-clients.md)).

Updates are only sent while a socket is connected; they aren't replayed. A reconnecting client gets the current view again, so it doesn't need to catch up separately.

## Server events

After every state transition of the game, each connected socket receives one event for it, in the socket's format. Transitions are accepted actions and players joining. Each player receives the view of their own audience.

Events arrive in `sequence` order.

### state

```ts
interface StateEvent<ViewType = unknown> {
  gameId: string;
  sequence: number; // as in GET …/state
  state: ViewType; // the player's whole view at this sequence
}
```

Sent on connect in both formats, and for each transition when `format` is `state`.

### patches

```ts
interface PatchesEvent {
  gameId: string;
  sequence: number;
  patches: Patch[]; // turn the view at sequence - 1 into the view at sequence
  checksum?: number; // the checksum of the view at sequence, unless the server turns checksums off
}
```

Sent for each transition when `format` is `immer`. Apply the patches to the view at `sequence - 1`.

When a transition moves the player to another audience, the patches lead from the old audience's view to the new one's ([0035](../explanation/decisions/0035-updates-across-audiences.md)). Patches may be empty when the player's view didn't change.

`checksum` is the [checksum](#checksums) of the view the patches lead to, unless the server turns `checksums` off. A client that computes another one for the view it built has gone wrong, and should fetch the whole view.

## Checksums

The checksum of a view is [cyrb53](https://github.com/bryc/code/blob/master/jshash/experimental/cyrb53.js), with seed 0, over the view's canonical JSON, read as UTF-16 code units ([0059](../explanation/decisions/0059-checksums-with-patches.md)). Canonical JSON is the view's JSON with every object's keys sorted by UTF-16 code units, no whitespace, and no keys whose value is `undefined`. The result is a non-negative safe integer. The library exports it as `checksumOf`, and the client package checks it by itself.

It detects mistakes, not tampering: two views share a checksum with a chance of about 1 in 10^16.

## Parser and compression

With the server's `socket.parser` option, events are encoded by that parser, such as MessagePack, instead of JSON; clients must use the same parser. With `socket.perMessageDeflate`, messages are compressed, which clients negotiate by themselves ([0060](../explanation/decisions/0060-socket-parser-and-compression-options.md)).

## Patch format

Patches are [Immer](https://immerjs.github.io/immer/patches) patches, so a client can apply them with `applyPatches` ([0014](../explanation/decisions/0014-immer-patches-only-external-format.md)):

```ts
interface Patch {
  op: "add" | "remove" | "replace";
  path: (string | number)[]; // object keys as strings, array indices as numbers
  value?: unknown; // for add and replace
}
```

The same format is used by [`GET …/updates`](http-api.md#get-apigamesgameidupdates).

States and views never contain keys named `__proto__` or `constructor`, so Immer can apply every patch ([0047](../explanation/decisions/0047-reserved-keys-dropped-with-warning.md)).

## Types

`StateEvent`, `PatchesEvent`, `Patch` and `Format` (`"state" | "immer"`) are exported by `@malte.muth/remote-state`.
