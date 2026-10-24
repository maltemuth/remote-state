# Schedule actions and time limits

Timers run an action later, such as ending a turn whose time ran out. The host's `dispatch` runs one now, such as an admin ending a game. Either way the action runs as the system: your rules get [`SYSTEM`](../reference/rules.md#system) as the player ID. The tic-tac-toe example has a turn limit ([turnTimer.ts](../../packages/remote-state-example-server/src/games/tic-tac-toe/turnTimer.ts)) and pauses on restart ([restart.ts](../../packages/remote-state-example-server/src/games/tic-tac-toe/restart.ts)).

## Add a turn timeout

Keep something in the state that tells turns apart, and the limit, so each game can have its own:

```ts
interface State {
  players: string[];
  toMove: number;
  moves: number; // identifies the turn
  winner: string | null;
  turnMs: number | null;
}

type Action = { type: "move" } | { type: "timeout"; moves: number };
```

Return every new state through one function that schedules the timer while the game runs, and cancels it otherwise. Scheduling a pending name replaces it, so each move restarts the clock:

```ts
const withTurnTimer = (state: State): StateResult<State, Action> => {
  if (state.turnMs === null) return state;
  if (state.winner || state.players.length < 2)
    return transition(state, { cancel: ["turn"] });
  return transition(state, {
    schedule: [
      {
        name: "turn",
        in: state.turnMs,
        action: { type: "timeout", moves: state.moves },
      },
    ],
  });
};

const game: Rules<State, Action> = {
  onJoin: (state, { memberId }) =>
    withTurnTimer({ ...state, players: [...state.players, memberId] }),
  executeAction: (state, action) =>
    action.type === "timeout"
      ? withTurnTimer({ ...state, winner: state.players[1 - state.toMove] })
      : withTurnTimer(applyMove(state, action)),
  validateAction: (state, action, memberId) => {
    if (action.type === "timeout") {
      if (memberId !== SYSTEM) return "Only the system can end a turn";
      return !state.winner && action.moves === state.moves
        ? true
        : "That turn is over";
    }
    if (state.winner) return "The game is over";
    return state.players[state.toMove] === memberId
      ? true
      : "It's not your turn";
  },
};
```

- **Accept a timeout only from `SYSTEM`, and only for its turn.** The library never runs a replaced or cancelled timer, but the check keeps the rules safe on their own.
- **Timers change only when a transition is recorded.** A rejected action leaves the running timer alone, and a rejected timer action records nothing.
- **Clients learn the outcome like any move.** The state doesn't say when the turn ends; put a deadline in it if clients should show one.
- **Test with a short limit,** such as 100 ms, set in the initial state.

## Dispatch from the host

```ts
const result = await server.dispatch(spaceId, { type: "end" });
if ("rejected" in result) console.log(result.rejected);
```

Accept it in `validateAction` only from `SYSTEM`, like a timeout. `dispatch` resolves to `{ sequence }` or `{ rejected }`, and throws `UnknownSpaceError` for an unknown game. A host can act only as the system, never as a player.

## Pause on a restart

Timers live in memory: a restart loses them, even with spaces [persisted](persist-spaces.md). What happens then is up to the rules ([0053](../explanation/decisions/0053-restarts-are-game-logic.md)). One way is to pause in `onRestart` and resume with the host's `dispatch` once everyone is back ([0052](../explanation/decisions/0052-games-pause-on-restart.md)):

```ts
onRestart: (state) => (state.winner || state.paused ? state : { ...state, paused: true }),

// in validateAction
if (action.type === "resume") {
  if (memberId !== SYSTEM) return "Only the host can resume the game";
  return state.paused ? true : "The game isn't paused";
}
if (state.paused) return "The game is paused";

// in executeAction
if (action.type === "resume") return withTurnTimer({ ...state, paused: false });
```

Returning the same state from `onRestart` records nothing. The host then calls `await server.dispatch(spaceId, { type: "resume" })`.

Exact timer behaviour: [Rules: Timers](../reference/rules.md#timers).
