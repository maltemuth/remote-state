# GamePlugin

A game is defined by a `GamePlugin` object passed to [`createRemoteStateServer`](server-api.md#createremotestateserver).

```ts
import type { GamePlugin } from "@malte.muth/remote-state";

interface GamePlugin<StateType, ActionType, PlayerStateType> {
  getInitialState: () => Promise<StateType>;
  validateAction: (state: StateType, action: ActionType, playerId: string) => Promise<ActionValidationResult>;
  executeAction: (state: StateType, action: ActionType, playerId: string) => Promise<StateType>;
  filterStateForPlayer?: (state: StateType, playerId: string) => Promise<PlayerStateType>;
  gameConfig?: { name: string; description?: string };
  serverConfiguration?: RemoteStateServerConfiguration;
}

type ActionValidationResult = true | string;
```

## Type parameters

| Parameter | Meaning |
|---|---|
| `StateType` | The complete state of one game, as stored by the server. Must survive a `JSON.stringify`/`JSON.parse` round trip: `Date`s come back as strings, and `Map`s, `Set`s and class instances are lost. |
| `ActionType` | What clients send as `action` in `POST …/actions`. |
| `PlayerStateType` | What one player is sent. Use `StateType` if there's no filter. |

## Members

### getInitialState

Called once per game, by `POST /api/games`. The result is stored as state `sequence: 0`. If it rejects, game creation fails with status 500.

### validateAction

Called for every submitted action, with the latest state.

- **`action`** is the client's `action` object exactly as sent. It hasn't been checked against `ActionType`, so validate its shape.
- **`playerId`** is the authenticated player. It's always a player of this game, but not necessarily one who has claimed a seat in your game's own terms.

Return `true` to accept the action. Return a string to reject it; the string becomes the `error` of the 400 response.

### executeAction

Called only after `validateAction` returned `true`, with the same state. Return the next state.

`action` is the client's object with two server-set fields added, which override any client values:

| Field | Value |
|---|---|
| `playerId` | The authenticated player |
| `timestamp` | A `Date` at the time of execution |

Treat `state` as read-only and return a new object. If this function throws, the request fails with status 500 and nothing is stored.

### filterStateForPlayer

Optional. Converts the full state to what `playerId` may see. It's applied to every state sent to a client:

- the response to that player's own action
- `GET …/state/current`
- each `game-state-update`

Without a filter, every client receives the full state.

It's called once for the acting player's response and once per connected socket on every update, so keep it cheap and free of side effects. It doesn't need to deep-copy, because results are only serialized.

### gameConfig

`name` is reported by `GET /health` and logged on startup. `description` is not used.

### serverConfiguration

See [Server API: configuration](server-api.md#remotestateserverconfiguration).
