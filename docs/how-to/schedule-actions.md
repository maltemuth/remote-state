# Schedule actions and time limits

Use timers when something must happen in a game without a player acting, such as a turn that ends when its time runs out. Use the host's `act` when the action comes from outside the game, such as an admin ending a game.

Either way, the action runs as the system: `validateAction` and `executeAction` receive [`SYSTEM`](../reference/game-plugin.md#system) as the player ID, and the action goes through your rules like a player's.

The tic-tac-toe example has a turn limit built this way, in [`turnTimer.ts`](../../packages/remote-state-example-server/src/games/tic-tac-toe/turnTimer.ts), and pauses on a restart as described [below](#pause-on-a-restart), in [`restart.ts`](../../packages/remote-state-example-server/src/games/tic-tac-toe/restart.ts).

## Add a turn timeout

The steps below give each player a time limit per move. When it runs out, the player to move loses.

### Identify the turn in the state

A timeout must apply only to the turn it was scheduled for. Keep something in the state that tells turns apart, such as the number of moves made, and put the limit in the state too, so each game can have its own:

```ts
interface State {
  players: string[];
  /** Index into `players` of whoever is to move */
  toMove: number;
  /** How many moves were made; identifies the current turn */
  moves: number;
  winner: string | null;
  /** Milliseconds per move, or null for no limit */
  turnMs: number | null;
}

type Action =
  | { type: "move" }
  /** Sent by the system when a turn's time runs out */
  | { type: "timeout"; moves: number };
```

### Schedule the timer with every state change

Write one function that takes the new state and returns it with the right timer. While the game is running, it schedules the timer named `turn`. Scheduling a name that's already pending replaces it, so every move starts the clock over. When the game isn't running, it cancels the timer:

```ts
import { transition, type StateResult } from "@malte.muth/remote-state";

const withTurnTimer = (state: State): StateResult<State, Action> => {
  if (state.turnMs === null) return state;
  if (state.winner || state.players.length < 2) {
    return transition(state, { cancel: ["turn"] });
  }
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
```

The timer's action carries `moves`, the turn it's for.

Return the result from `onJoin` and `executeAction`, so that the timer starts when the second player joins, restarts with every move, and stops when the game ends:

```ts
const game: GamePlugin<State, Action> = {
  onJoin: (state, { playerId }) => {
    if (state.players.length === 2) throw new GameRefusal("The game is full");
    return withTurnTimer({ ...state, players: [...state.players, playerId] });
  },
  executeAction: (state, action) => withTurnTimer(applyAction(state, action)),
  // …
};
```

Timers change only when an action or join is accepted. A rejected action leaves the running timer alone.

### Accept the timeout only from the system, for the current turn

In `validateAction`, accept a `timeout` only from `SYSTEM`, and only for the turn it was scheduled for:

```ts
import { SYSTEM } from "@malte.muth/remote-state";

validateAction: (state, action, playerId) => {
  if (action.type === "timeout") {
    if (playerId !== SYSTEM) return "Only the system can end a turn";
    if (state.winner || action.moves !== state.moves) return "That turn is over";
    return true;
  }
  if (state.winner) return "The game is over";
  if (state.players[state.toMove] !== playerId) return "It's not your turn";
  return true;
},
```

The library doesn't run a timer that was replaced or cancelled, but checking the turn keeps the rules safe on their own: a timeout for a turn that's over is rejected, wherever it comes from. A rejected timer action is logged at `info`, and nothing is recorded.

Check the other actions against `SYSTEM` too. Here, the turn check rejects every move from the system, since it's never the player to move.

### Apply the timeout

In `executeAction`, end the game in favor of the player who isn't to move:

```ts
case "timeout":
  return { ...state, winner: state.players[1 - state.toMove] };
```

The timeout is recorded with the next `sequence` and sent to clients like any move, so clients need nothing new to receive it. To show the limit to players, read it from the state. The state doesn't say when the turn ends; the timer runs on the server only.

## Act from the host

When an action comes from outside the game, such as an admin ending a game or a move from a computer player that the host runs, call [`act`](../reference/server-api.md#act) on the server or `RemoteState`:

```ts
const result = await server.act(gameId, { type: "end" });
if ("rejected" in result) {
  console.log(`Not ended: ${result.rejected}`);
}
```

The action runs as the system, through your rules. Add it to the game's action type, here `{ type: "end" }`, and accept it in `validateAction` like a timeout, only from `SYSTEM`:

```ts
if (action.type === "end") {
  if (playerId !== SYSTEM) return "Only the host can end a game";
  return state.winner ? "The game is over" : true;
}
```

`act` resolves to `{ sequence }` if the action was accepted, or `{ rejected }` with the reason. For a game that doesn't exist, it rejects with `UnknownGameError`.

A host can't act as one of the players, only as the system.

## Pause on a restart

Timers are kept in memory only, even when games are [persisted](persist-games.md). When the server stops, every pending timer is lost, and it isn't started again when the server comes back ([0042](../explanation/decisions/0042-timer-restarts-open.md)). Without more, a game whose turn was running has no timeout for that turn, and the first player back to act starts the next clock, whether or not the others have reconnected.

What to do instead is up to the game ([0053](../explanation/decisions/0053-restarts-are-game-logic.md)). For a turn timer, one way is to pause the game in `onRestart`, and resume it with an action once everyone is back ([0052](../explanation/decisions/0052-games-pause-on-restart.md)). With the game above, add `paused: boolean` to `State` and `{ type: "resume" }` to `Action`. Resuming starts the turn over with its full time:

```ts
const game: GamePlugin<State, Action> = {
  // …
  onRestart: (state) =>
    state.winner || state.paused ? state : { ...state, paused: true },

  validateAction: (state, action, playerId) => {
    if (action.type === "resume") {
      if (playerId !== SYSTEM) return "Only the host can resume the game";
      return state.paused ? true : "The game isn't paused";
    }
    if (state.paused) return "The game is paused";
    // …
  },

  executeAction: (state, action) =>
    action.type === "resume"
      ? withTurnTimer({ ...state, paused: false })
      : withTurnTimer(applyAction(state, action)),
};
```

Returning the state unchanged, as for a finished game, records nothing. The host resumes a game with `act`:

```ts
await server.act(gameId, { type: "resume" });
```

How the host learns that everyone is back is up to it. The example host has no login, so its lobby resumes a tic-tac-toe game for anyone who asks, at `POST /tic-tac-toe/lobby/games/:gameId/resume`, and the browser client shows a Resume button while the game is paused. A real host would let only the game's host do that.

## Test it

Make the limit part of the initial state, as above, so tests can use a short one, such as 100 milliseconds, and wait for it. See [Test a game plugin](test-a-game-plugin.md).

See [GamePlugin](../reference/game-plugin.md#timers) for exactly how timers behave.
