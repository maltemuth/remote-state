# Rules

A space runs on your rules: a `Rules` object passed to [`createRemoteStateServer`](server-api.md#createremotestateserver) or [`createRemoteState`](server-api.md#createremotestate). Deployment settings, such as the database, aren't part of the rules; they're [options](server-api.md#options) of those functions.

```ts
import type { Rules } from "@malte.muth/remote-state";

interface Rules<StateType, ActionType, ViewType = StateType> {
  validateAction: (
    state: StateType,
    action: ActionType,
    memberId: string,
  ) => Awaitable<ActionValidationResult>;
  executeAction: (
    state: StateType,
    action: ActionType,
    memberId: string,
  ) => Awaitable<StateResult<StateType, ActionType>>;
  onJoin?: (
    state: StateType,
    member: JoiningMember,
  ) => Awaitable<StateResult<StateType, ActionType>>;
  onRestart?: (
    state: StateType,
  ) => Awaitable<StateResult<StateType, ActionType>>;
  view?: (state: StateType, audience: string) => Awaitable<ViewType>;
}

type Awaitable<T> = T | Promise<T>;
type ActionValidationResult = true | string;
type StateResult<StateType, ActionType = unknown> =
  StateType | Transition<StateType, ActionType>; // see transition
interface JoiningMember {
  memberId: string;
  details: Record<string, unknown>;
}
```

Every function may return a plain value or a promise.

The rules have no function for the initial state. The host builds it and passes it to [`createSpace`](server-api.md#remotestateserver) ([0036](../explanation/decisions/0036-hosts-pass-the-initial-state.md)).

## Type parameters

| Parameter    | Meaning                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `StateType`  | The complete state of one space, as stored by the server. States are normalized with a `JSON.stringify`/`JSON.parse` round trip before they're stored, diffed and passed back to the rules: `Date`s become strings, and `Map`s, `Set`s, class instances and `undefined` properties are lost. Keys named `__proto__` and `constructor` are dropped at any depth, with a warning in the log, because clients couldn't apply patches through them ([0047](../explanation/decisions/0047-reserved-keys-dropped-with-warning.md)). Views returned by `view` lose them the same way. |
| `ActionType` | What clients send as `action` in `POST …/actions`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `ViewType`   | What one audience is sent. Defaults to `StateType`, for rules without `view`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

## Functions

### validateAction

Called for every submitted action, with the latest state.

- **`action`** is the client's `action` value exactly as sent. It hasn't been checked against `ActionType`, so validate its shape.
- **`memberId`** is the authenticated member. It's always a member of this space, but not necessarily one your rules have seated, such as a spectator. For actions of the system, from a due [timer](#timers) or the host's [`dispatch`](server-api.md#dispatch), it's [`SYSTEM`](#system).

Return `true` to accept the action. Return a string to reject it; the string becomes the `error` of the 400 response. If it throws a [`Refusal`](#refusal), the action is rejected the same way, with its message; any other error fails the request with status 500.

### executeAction

Called only after `validateAction` returned `true`, with the same state, the same `action` and the same `memberId`. Return the next state, or [`transition(state, changes)`](#transition) to also move members between audiences or schedule and cancel [timers](#timers).

Treat `state` as read-only and return a new object.

- Throw a [`Refusal`](#refusal) to reject the action after all; its message becomes the `error` of a 400 response.
- Any other error fails the request with status 500.

Either way, nothing is stored.

### onJoin

Optional. Called when an admission code is redeemed at [`POST /api/tokens`](http-api.md#post-apitokens) for an identity that has no member in this space yet. It runs once per identity and space ([0026](../explanation/decisions/0026-join-hook-is-a-state-transition.md)).

| Field of `member` | Value                                                     |
| ----------------- | --------------------------------------------------------- |
| `memberId`        | The new member's ID, chosen by the library                |
| `details`         | The identity the host passed to `admit`, without its `id` |

Return the state with the member added, or [`transition(state, changes)`](#transition) to also set audiences, including the joining member's, or schedule and cancel timers. Throw a `Refusal` to refuse the member: the client gets 403 with its message, no member is created, and the code is used up. Any other error fails the request with status 500.

A join is a state transition like an action: it's stored with the next `sequence` and action type `join`, and sent to connected members.

Without `onJoin`, everyone the host admits joins, and the state stays unchanged, though the join still adds a sequence.

### onRestart

Optional. Called for every stored space when `createRemoteState` or `createRemoteStateServer` starts on a database that already has spaces, with each space's latest state, before anything is served ([0052](../explanation/decisions/0052-games-pause-on-restart.md)). Pending [timers](#timers) didn't survive the restart. What happens then is up to the rules ([0053](../explanation/decisions/0053-restarts-are-game-logic.md)): for example, they pause the space, returning a state in which it waits to be resumed by an action, such as the host's [`dispatch`](server-api.md#remotestateserver); or they schedule its timers again, through [`transition`](#transition).

- **Return the state it was given** to record nothing; most spaces, finished ones among them, have nothing to do.
- **A changed state, or any changes,** are recorded like an action's: with the next `sequence`, action type `restart`, the system as author, and sent to clients that connect.
- **It runs as [`SYSTEM`](#system),** under the space's lock, one space after the other.
- **If it throws,** the error is logged at `error` and that space is left as it was. The other spaces are still offered the hook, and the server starts.

### view

Optional. Converts the full state to what one audience may see ([0024](../explanation/decisions/0024-views-per-audience.md)). Every view a client receives passes through it: socket events, `GET …/state` and `GET …/updates`.

Each member belongs to one audience ([0025](../explanation/decisions/0025-default-audiences.md)):

- **With `view`,** a member's default audience is their member ID, so `audience` can be read as the member.
- **Without `view`,** every member is in the single audience `everyone` (exported as `EVERYONE`) and receives the full state.
- **Either way,** `onJoin` and `executeAction` can move members to other audiences with `transition` or `withAudiences`, such as `spectators`.

`view` is called once per audience with members on every transition, for the previous and the new state, and again on reads. Views of past states are rebuilt from stored states, so the result must depend only on `state` and `audience`: no clocks, randomness or other side effects. Return JSON-compatible values.

## Timers

The rules can schedule actions to run later, for example to end a turn when its time runs out ([0040](../explanation/decisions/0040-server-initiated-actions.md), [0041](../explanation/decisions/0041-named-timers.md)). `onJoin` and `executeAction` return the timers with the new state, through [`transition`](#transition). See [Schedule actions and time limits](../how-to/schedule-actions.md).

- **Timers are named, per space.** Scheduling a name that's already pending in the space replaces that timer. Cancelling drops pending timers by name; cancelling a name that isn't pending does nothing. Within one transition, cancellations are applied before the schedule.
- **They take effect once the transition is recorded.** If it isn't, because the request fails, nothing is scheduled or cancelled.
- **A due timer runs its action as [`SYSTEM`](#system),** under the space's lock, like any action: through `validateAction` and `executeAction`, recorded in the history, and sent to clients. Its action can return timers of its own. It runs only if the timer is still pending, so a timer replaced or cancelled in the meantime never runs.
- **A rejected timer action records nothing.** If `validateAction` returns a string or a `Refusal` is thrown, the rejection is logged at `info`. Any other error is logged at `error`. Either way, nothing is stored.
- **Timers are kept in memory only.** When the server stops, pending timers are lost, and they don't come back on restart ([0042](../explanation/decisions/0042-timer-restarts-open.md)). The rules pick up from there in [`onRestart`](#onrestart), by pausing or scheduling again; without it, a space waiting for a timeout waits until something else happens in it, such as a member's action. `close()` drops all pending timers.

The system can't act through the HTTP API: member IDs are UUIDs, so no member's ID is `"system"`. The rules must still decide what the system may do. Accept a system action only where you expect one, and check that it still applies to the current state, since a timer can't tell whether the state it was scheduled for has passed.

## Helpers

### transition

```ts
transition<StateType, ActionType = unknown>(
  state: StateType,
  changes: TransitionChanges<ActionType>,
): Transition<StateType, ActionType>

interface TransitionChanges<ActionType = unknown> {
  audiences?: AudienceChanges;
  schedule?: TimerRequest<ActionType>[];
  cancel?: string[]; // names of pending timers to drop
}

interface TimerRequest<ActionType = unknown> {
  name: string;
  in: number; // milliseconds
  action: ActionType; // run as SYSTEM when the timer is due
}

type AudienceChanges = Record<string, string | null>; // member ID → audience
```

Returns a state together with changes, from `onJoin` or `executeAction`. All changes are optional.

**`audiences`** moves members between audiences ([0027](../explanation/decisions/0027-audiences-set-by-join-hook-and-actions.md)). Each key is a member ID of this space; in `onJoin`, that includes the joining member. Each value is the member's new audience, or `null` to return them to their default audience. Members not listed keep their audience. A change for a member the space doesn't have fails the request with status 500, and nothing is stored.

**`schedule`** starts [timers](#timers): each runs `action` as the system in `in` milliseconds, replacing any pending timer with the same `name`. `name` must be a non-empty string and `in` a number from 0 to 2³¹ − 1 (about 24.8 days); otherwise the transition fails like any other error from the rules: a request with status 500, and nothing is stored.

**`cancel`** drops the pending timers with these names. Each must be a non-empty string; otherwise the transition fails the same way.

```ts
executeAction: (state, action) => {
  const next = applyMove(state, action);
  if (next.winner) return transition(next, { cancel: ["turn"] });
  return transition(next, {
    schedule: [{ name: "turn", in: 30_000, action: { type: "timeout", turn: next.turn } }],
  });
},
```

### withAudiences

```ts
withAudiences<StateType>(state: StateType, audiences: AudienceChanges): Transition<StateType, never>
```

Shorthand for `transition(state, { audiences })`.

```ts
executeAction: (state, action, memberId) => {
  if (action.type === "fold") {
    return withAudiences(foldedState(state, memberId), { [memberId]: "spectators" });
  }
  // …
},
```

### Refusal

```ts
class Refusal extends Error {
  constructor(reason: string);
}
```

Throw it from `onJoin` or `executeAction` to refuse on purpose. Its message is sent to the client: with 403 from `onJoin`, with 400 from `executeAction`. Any other error is treated as a server error, and its message isn't sent.

### SYSTEM

`"system"`: the `memberId` that `validateAction` and `executeAction` receive for actions of the system, from due timers and the host's [`dispatch`](server-api.md#dispatch) ([0040](../explanation/decisions/0040-server-initiated-actions.md)). Members never have this ID. The history stores system actions without a member.

### EVERYONE

`"everyone"`: the audience of every member in a space without `view`, unless the rules set another.
