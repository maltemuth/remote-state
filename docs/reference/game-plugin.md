# GamePlugin

A game is defined by a `GamePlugin` object passed to [`createRemoteStateServer`](server-api.md#createremotestateserver).

```ts
import type { GamePlugin } from "@malte.muth/remote-state";

interface GamePlugin<StateType, ActionType, ViewType = StateType> {
  validateAction: (
    state: StateType,
    action: ActionType,
    playerId: string,
  ) => Awaitable<ActionValidationResult>;
  executeAction: (
    state: StateType,
    action: ActionType,
    playerId: string,
  ) => Awaitable<StateResult<StateType>>;
  onJoin?: (
    state: StateType,
    player: JoiningPlayer,
  ) => Awaitable<StateResult<StateType>>;
  filterStateForAudience?: (
    state: StateType,
    audience: string,
  ) => Awaitable<ViewType>;
  gameConfig?: { name: string; description?: string };
  serverConfiguration?: RemoteStateServerConfiguration;
}

type Awaitable<T> = T | Promise<T>;
type ActionValidationResult = true | string;
type StateResult<StateType> = StateType | Transition<StateType>; // see withAudiences
interface JoiningPlayer {
  playerId: string;
  details: Record<string, unknown>;
}
```

Every function may return a plain value or a promise.

The plugin has no function for the initial state. The host builds it and passes it to [`createGame`](server-api.md#remotestateserver) ([0036](../explanation/decisions/0036-hosts-pass-the-initial-state.md)).

## Type parameters

| Parameter    | Meaning                                                                                                                                                                                                                                                                                    |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `StateType`  | The complete state of one game, as stored by the server. States are normalized with a `JSON.stringify`/`JSON.parse` round trip before they're stored, diffed and passed back to the game: `Date`s become strings, and `Map`s, `Set`s, class instances and `undefined` properties are lost. |
| `ActionType` | What clients send as `action` in `POST …/actions`.                                                                                                                                                                                                                                         |
| `ViewType`   | What one audience is sent. Defaults to `StateType`, for games without a filter.                                                                                                                                                                                                            |

## Members

### validateAction

Called for every submitted action, with the latest state.

- **`action`** is the client's `action` value exactly as sent. It hasn't been checked against `ActionType`, so validate its shape.
- **`playerId`** is the authenticated player. It's always a player of this game, but not necessarily one your game has seated, such as a spectator.

Return `true` to accept the action. Return a string to reject it; the string becomes the `error` of the 400 response. If it throws a [`GameRefusal`](#gamerefusal), the action is rejected the same way, with its message; any other error fails the request with status 500.

### executeAction

Called only after `validateAction` returned `true`, with the same state and the same `action`. Return the next state, or [`withAudiences(state, changes)`](#withaudiences) to also move players between audiences.

Treat `state` as read-only and return a new object.

- Throw a [`GameRefusal`](#gamerefusal) to reject the action after all; its message becomes the `error` of a 400 response.
- Any other error fails the request with status 500.

Either way, nothing is stored.

### onJoin

Optional. Called when an admission code is redeemed at [`POST /api/tokens`](http-api.md#post-apitokens) for an identity that has no player in this game yet. It runs once per identity and game ([0026](../explanation/decisions/0026-join-hook-is-a-state-transition.md)).

| Field of `player` | Value                                                     |
| ----------------- | --------------------------------------------------------- |
| `playerId`        | The new player's ID, chosen by the library                |
| `details`         | The identity the host passed to `admit`, without its `id` |

Return the state with the player added, or `withAudiences(state, changes)` to also set audiences, including the joining player's. Throw a `GameRefusal` to refuse the player: the client gets 403 with its message, no player is created, and the code is used up. Any other error fails the request with status 500.

A join is a state transition like an action: it's stored with the next `sequence` and action type `join`, and sent to connected players.

Without `onJoin`, everyone the host admits joins, and the state stays unchanged, though the join still adds a sequence.

### filterStateForAudience

Optional. Converts the full state to what one audience may see ([0024](../explanation/decisions/0024-views-per-audience.md)). Every view a client receives passes through it: socket events, `GET …/state` and `GET …/updates`.

Each player belongs to one audience ([0025](../explanation/decisions/0025-default-audiences.md)):

- **With a filter,** a player's default audience is their player ID, so `audience` can be read as the player.
- **Without a filter,** every player is in the single audience `everyone` (exported as `EVERYONE`) and receives the full state.
- **Either way,** `onJoin` and `executeAction` can move players to other audiences with `withAudiences`, such as `spectators`.

The filter is called once per audience with members on every transition, for the previous and the new state, and again on reads. Views of past states are rebuilt from stored states, so the result must depend only on `state` and `audience`: no clocks, randomness or other side effects. Return JSON-compatible values.

### gameConfig

`name` is reported by `GET /health`. `description` is not used.

### serverConfiguration

See [Server API: configuration](server-api.md#remotestateserverconfiguration).

## Helpers

### withAudiences

```ts
withAudiences<StateType>(state: StateType, audiences: AudienceChanges): Transition<StateType>

type AudienceChanges = Record<string, string | null>; // player ID → audience
```

Returns a state together with audience changes, from `onJoin` or `executeAction` ([0027](../explanation/decisions/0027-audiences-set-by-join-hook-and-actions.md)). Each key is a player ID of this game; in `onJoin`, that includes the joining player. Each value is the player's new audience, or `null` to return them to their default audience. Players not listed keep their audience.

A change for a player the game doesn't have fails the request with status 500, and nothing is stored.

```ts
executeAction: (state, action, playerId) => {
  if (action.type === "fold") {
    return withAudiences(foldedState(state, playerId), { [playerId]: "spectators" });
  }
  // …
},
```

### GameRefusal

```ts
class GameRefusal extends Error {
  constructor(reason: string);
}
```

Throw it from `onJoin` or `executeAction` to refuse on purpose. Its message is sent to the client: with 403 from `onJoin`, with 400 from `executeAction`. Any other error is treated as a server error, and its message isn't sent.

### EVERYONE

`"everyone"`: the audience of every player in a game without `filterStateForAudience`, unless the game set another.
