# HTTP API

All endpoints accept and return JSON. Errors have the form `{ "error": "<message>" }`.

Paths are relative to where the host mounts the library's router: at the root with [`createRemoteStateServer`](server-api.md#createremotestateserver), or under a prefix of the host's choosing with [`createRemoteState`](server-api.md#createremotestate). Under the prefix `/tic-tac-toe`, for example, `POST /api/tokens` is `POST /tic-tac-toe/api/tokens`.

Routes under `/api` that don't exist return `404 { "error": "Endpoint not found" }`. Paths outside `/api` are left to the host application.

Under `/api`, a request body that isn't valid JSON is answered with 400 and the parser's message, and unexpected errors are answered with `500 { "error": "Internal server error" }`.

CORS applies to the routes under `/api` and allows all origins, unless the server's [`cors` option](server-api.md#options) says otherwise.

There are no endpoints for creating or joining games. The host application does both in-process, with [`createGame` and `admit`](server-api.md#remotestateserver), and adds its own routes for them. See [Create games and admit players](../how-to/admit-players.md).

## Authentication

Endpoints under `/api/games/:gameId` act as a player. They take the player's token in the `Authorization` header:

```
Authorization: Bearer <token>
```

The header is the only place for tokens; they're never accepted in the body or the URL. A token only works for the game it was issued for. A player may hold several tokens, and all of them stay valid. Tokens don't expire.

Without a valid token for the game in the URL, these endpoints answer `401 { "error": "Invalid or missing token" }`. That includes a token for another game and a game that doesn't exist.

## POST /api/tokens

Exchanges an admission code, issued by the host with `admit`, for a token.

**Request body**

| Field  | Type              | Required |
| ------ | ----------------- | -------- |
| `code` | string, non-empty | yes      |

Codes are single-use, and valid for one minute after `admit` returns them (`CODE_LIFETIME_MS`). Redeeming a code uses it up, whatever the outcome.

If the code's identity has no player in the game yet, the game's [`onJoin`](game-plugin.md#onjoin) runs. If it accepts, a player is created and the join is recorded as a new state. If the identity already has a player, that player gets a new token, and `onJoin` doesn't run.

**Responses**

| Status | Body                                                        |
| ------ | ----------------------------------------------------------- |
| 201    | `{ "gameId": string, "playerId": string, "token": string }` |
| 400    | `A code is required`                                        |
| 401    | `Invalid, used or expired code`                             |
| 403    | The reason of the `GameRefusal` thrown by `onJoin`          |
| 500    | `Internal server error`                                     |

`playerId` is public and may appear in game state. `token` is the player's credential: 64 hex characters.

## POST /api/games/:gameId/actions

Submits an action on behalf of the authenticated player. The server:

1. validates the action with [`validateAction`](game-plugin.md#validateaction)
2. executes it with [`executeAction`](game-plugin.md#executeaction)
3. stores the resulting state, with the next `sequence`
4. sends the new state to every connected socket of the game, as a [`state` or `patches` event](socket-events.md#server-events)
5. answers the request

Actions and joins on the same game are processed one at a time. A client shouldn't rely on the socket event arriving before or after the response.

**Request body**

| Field    | Type                                   | Required |
| -------- | -------------------------------------- | -------- |
| `action` | any JSON value; the game's action type | yes      |

`action.type`, if it's a string, is stored as the action type in the state history; otherwise `unknown` is stored.

**Responses**

| Status | Body                                                                                     |
| ------ | ---------------------------------------------------------------------------------------- |
| 201    | `{ "sequence": number }`: the sequence of the state this action produced                 |
| 400    | `An action is required`                                                                  |
| 400    | The message returned by `validateAction`                                                 |
| 400    | The reason of a `GameRefusal` thrown by `executeAction`                                  |
| 401    | `Invalid or missing token`                                                               |
| 500    | `Internal server error`, including any other error thrown by the game; nothing is stored |

The new state isn't in the response. It arrives over the socket, which tells the client which update its action produced by `sequence` ([0034](../explanation/decisions/0034-action-response-with-sequence.md)).

## GET /api/games/:gameId/state

Returns the authenticated player's view of the latest state.

**Responses**

| Status | Body                                                      |
| ------ | --------------------------------------------------------- |
| 200    | `{ "gameId": string, "sequence": number, "state": View }` |
| 401    | `Invalid or missing token`                                |
| 500    | `Internal server error`                                   |

| Field      | Description                                                                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `sequence` | Position in the game's history: 0 is the initial state from `createGame`, and each join and accepted action adds 1                                     |
| `state`    | The view of the player's audience, from [`filterStateForAudience`](game-plugin.md#filterstateforaudience), or the full state if the game has no filter |

## GET /api/games/:gameId/updates

Returns one set of patches that turns the player's view at `since` into their current view ([0030](../explanation/decisions/0030-updates-in-one-jump.md), [0035](../explanation/decisions/0035-updates-across-audiences.md)).

**Query parameters**

| Parameter | Type                                              | Required |
| --------- | ------------------------------------------------- | -------- |
| `since`   | non-negative integer: a `sequence` the client has | yes      |

**Responses**

| Status | Body                                                                            |
| ------ | ------------------------------------------------------------------------------- |
| 200    | `{ "gameId": string, "since": number, "sequence": number, "patches": Patch[] }` |
| 303    | No body. `Location: state`, which resolves to `GET /api/games/:gameId/state`    |
| 400    | `` `since` must be a sequence number ``                                         |
| 401    | `Invalid or missing token`                                                      |
| 404    | `No updates since <since> for this player`                                      |
| 500    | `Internal server error`                                                         |

- **200:** `sequence` is the latest sequence. `patches` is empty when `since` is the latest sequence. Patches are in [Immer's format](socket-events.md#patch-format); apply them in order to the view at `since`. If the player changed audience after `since`, the patches lead from the old audience's view to the new one's.
- **303:** no patch can be built, because a state the server needs is missing. Fetch the whole state instead. The `Location` is relative, so it leads to the state endpoint under any prefix.
- **404:** `since` is after the latest sequence, or before the player joined. The first sequence a player can use is the one their join produced.

## GET /api/health

Unauthenticated. Answers while the process runs; it doesn't check the database ([0049](../explanation/decisions/0049-health-check-under-the-api.md)).

```json
{ "status": "ok", "game": "<gameConfig.name or Unknown Game>" }
```
