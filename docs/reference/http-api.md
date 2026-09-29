# HTTP API

All endpoints accept and return JSON. Errors have the form `{ "error": "<message>" }`.

Routes under `/api` that don't exist return `404 { "error": "Endpoint not found" }`. Paths outside `/api` are left to the host application.

CORS is enabled for all origins.

## Authentication

Endpoints that act as a player take the token issued when the player was created, sent in either of two ways:

- **header:** `Authorization: Bearer <token>`
- **body:** a `token` field, supported by `POST /api/games/:gameId/actions` only

A token only works for the game it was issued for. Tokens don't expire.

## POST /api/games

Creates a game, its first player (role `admin`), and the initial state from `GamePlugin.getInitialState`.

**Request body**

| Field | Type | Required |
|---|---|---|
| `gameName` | string, non-empty | yes |
| `playerName` | string, non-empty | yes |

**Responses**

| Status | Body |
|---|---|
| 201 | `{ "gameId": string, "token": string, "playerId": string }` |
| 400 | `Player name and game name are required` |
| 500 | `Internal server error` (includes `getInitialState` rejecting) |

## POST /api/games/:gameId/players

Registers another player (role `player`) for a game. Registering does not change game state. Games that have seats need a separate action to claim one, such as `join` in the examples.

Connected players receive a [`player-joined`](socket-events.md#player-joined) event.

**Request body**

| Field | Type | Required |
|---|---|---|
| `playerName` | string, non-empty | yes |

**Responses**

| Status | Body |
|---|---|
| 201 | `{ "success": true, "playerId": string, "token": string, "gameId": string, "message": string }` |
| 400 | `Player name and game ID are required` |
| 404 | `Game not found` |
| 500 | `Internal server error` |

## POST /api/games/:gameId/actions

Submits an action on behalf of the authenticated player. The server:

1. validates the action with `GamePlugin.validateAction`
2. executes it with `GamePlugin.executeAction`
3. stores the resulting state
4. sends every connected player a [`game-state-update`](socket-events.md#game-state-update)

Actions on the same game are processed one at a time.

**Request body**

| Field | Type | Required |
|---|---|---|
| `action` | object; the game's action type | yes |
| `token` | string | unless sent as a bearer header |

`action.type`, if present, is stored as the action type in the state history.

**Responses**

| Status | Body |
|---|---|
| 201 | The new state, filtered for the acting player |
| 400 | `Action is required` |
| 400 | The message returned by `validateAction` |
| 401 | `Invalid or expired token` (missing, unknown, or from another game) |
| 404 | `No game found with id <gameId>` |
| 500 | `Internal server error` |

## GET /api/games/:gameId/state/:cursor

Returns the latest state, filtered for the authenticated player. The token must be sent as a bearer header.

`:cursor` is required by the route but currently ignored. Clients use `current`.

**Responses**

| Status | Body |
|---|---|
| 200 | See below |
| 401 | `Invalid or expired token` |
| 404 | `Game not found` |
| 500 | `Internal server error` |

```json
{
  "gameId": "8bae4c83-…",
  "stateId": "640690de-…",
  "sequence": 4,
  "state": { },
  "timestamp": "2026-09-29T17:02:08.163Z"
}
```

| Field | Description |
|---|---|
| `stateId` | ID of the stored state |
| `sequence` | Position in the game's history: 0 is the initial state, and each accepted action adds 1 |
| `state` | The state after `filterStateForPlayer`, or the full state if the plugin has no filter |
| `timestamp` | When the state was stored |

## GET /health

```json
{ "status": "ok", "timestamp": "…", "game": "<gameConfig.name or Unknown Game>" }
```

## POST /admin/log-level

Only registered when `NODE_ENV` is not `production`. Unauthenticated.

Request body: `{ "level": "debug" | "info" | "warn" | "error" }`. Sets the global log level of the process.

| Status | Body |
|---|---|
| 200 | `{ "success": true, "message": "Log level set to <level>" }` |
| 400 | `{ "success": false, "message": "Invalid log level. …" }` |
