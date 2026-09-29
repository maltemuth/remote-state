# Build your first game: rock, paper, scissors

In this tutorial you build a two-player rock-paper-scissors server with Remote State, play a round from the command line, and watch the updates arrive live over Socket.IO.

Along the way you'll see the three things every Remote State game does:

- **validate** actions, so players can only make legal moves
- **execute** actions, turning the current state into the next one
- **filter** state, so each player only sees what they're allowed to see

The filter matters in this game: you must not see your opponent's choice before you make your own.

Allow about 20 minutes.

## Before you start

You need Node.js 24 or newer, `curl`, and a clone of this repository with dependencies installed:

```sh
npm install
```

You'll write the game inside the example server package, which is already set up to use the library.

## 1. Describe the game's state and actions

Create `packages/remote-state-example-server/src/rps-server.ts` and start with the types:

```ts
import {
  createRemoteStateServer,
  type GamePlugin,
} from "@malte.muth/remote-state";

type Choice = "rock" | "paper" | "scissors";

// Everything the server knows about a game
interface RpsState {
  players: string[];
  choices: Record<string, Choice>;
  winner: string | null;
}

// What players can ask the server to do
type RpsAction = { type: "join" } | { type: "choose"; choice: Choice };

// What a single player gets to see
interface RpsView {
  players: string[];
  choices: Record<string, Choice>;
  opponentHasChosen: boolean;
  winner: string | null;
}

const beats: Record<Choice, Choice> = {
  rock: "scissors",
  paper: "rock",
  scissors: "paper",
};
```

There are three types because the server keeps the whole truth (`RpsState`) but hands each player a view of it (`RpsView`).

## 2. Write the rules

Add the game plugin below the types. Remote State calls these functions and handles everything else:

```ts
const rockPaperScissors: GamePlugin<RpsState, RpsAction, RpsView> = {
  getInitialState: async () => ({ players: [], choices: {}, winner: null }),

  validateAction: async (state, action, playerId) => {
    if (action.type === "join") {
      if (state.players.includes(playerId)) return "You already joined";
      if (state.players.length === 2) return "Game is full";
      return true;
    }
    if (action.type === "choose") {
      if (!state.players.includes(playerId)) return "Join the game first";
      if (state.players.length < 2) return "Waiting for an opponent";
      if (state.choices[playerId]) return "You already chose";
      if (!(action.choice in beats)) return "Choose rock, paper or scissors";
      return true;
    }
    return "Unknown action";
  },

  executeAction: async (state, action, playerId) => {
    if (action.type === "join") {
      return { ...state, players: [...state.players, playerId] };
    }
    const choices = { ...state.choices, [playerId]: action.choice };
    const [first, second] = state.players;
    let winner: string | null = null;
    if (choices[first] && choices[second]) {
      winner =
        choices[first] === choices[second]
          ? "draw"
          : beats[choices[first]] === choices[second]
            ? first
            : second;
    }
    return { ...state, choices, winner };
  },

  filterStateForPlayer: async (state, playerId) => {
    const opponent = state.players.find((id) => id !== playerId);
    const finished = state.winner !== null;
    return {
      players: state.players,
      // Reveal every choice once the round is over, until then only your own
      choices: finished
        ? state.choices
        : Object.fromEntries(
            Object.entries(state.choices).filter(([id]) => id === playerId)
          ),
      opponentHasChosen: opponent !== undefined && opponent in state.choices,
      winner: state.winner,
    };
  },
};
```

`validateAction` returns `true` to accept an action, or a message explaining why it's rejected. `executeAction` only ever sees actions that passed validation.

## 3. Start the server

Add the last two lines to the file:

```ts
const server = await createRemoteStateServer(rockPaperScissors, 3001);
await server.startServer();
```

Build and run it:

```sh
npm run build
node packages/remote-state-example-server/dist/rps-server.js
```

The log ends with:

```
info  remote-state-server Remote State server listening at http://localhost:3001
```

Leave it running and open a second terminal for the rest of the tutorial.

## 4. Create a game and invite a player

Alice creates a game:

```sh
curl -s -X POST localhost:3001/api/games \
  -H 'Content-Type: application/json' \
  -d '{"gameName":"Best of one","playerName":"Alice"}'
```

```json
{"gameId":"8bae4c83-…","token":"b66a4bf3…","playerId":"e8613a89-…"}
```

The token is Alice's password for this game. Copy the values into shell variables so the next commands are shorter:

```sh
export GAME=<gameId from the response>
export ALICE=<token from the response>
```

Bob registers for the same game:

```sh
curl -s -X POST localhost:3001/api/games/$GAME/players \
  -H 'Content-Type: application/json' \
  -d '{"playerName":"Bob"}'
```

```sh
export BOB=<token from Bob's response>
```

## 5. Watch the game live

Game state changes are pushed to connected players over Socket.IO. Create `watch.mjs` in the repository root:

```js
import { io } from "socket.io-client";

const [gameId, token] = process.argv.slice(2);
const socket = io("http://localhost:3001", { auth: { gameId, token } });

socket.on("connect", () => console.log("connected"));
socket.on("connect_error", (error) => console.log("refused:", error.message));
socket.on("game-state-update", (update) =>
  console.log(`state #${update.sequence}:`, JSON.stringify(update.state))
);
```

Run it as Bob in a third terminal:

```sh
node watch.mjs $GAME $BOB
```

It prints `connected` and waits.

## 6. Play a round

Alice tries to choose before she has joined:

```sh
curl -s -X POST localhost:3001/api/games/$GAME/actions \
  -H "Authorization: Bearer $ALICE" -H 'Content-Type: application/json' \
  -d '{"action":{"type":"choose","choice":"rock"}}'
```

```json
{"error":"Join the game first"}
```

That's your `validateAction` at work. Both players join:

```sh
curl -s -X POST localhost:3001/api/games/$GAME/actions \
  -H "Authorization: Bearer $ALICE" -H 'Content-Type: application/json' \
  -d '{"action":{"type":"join"}}'

curl -s -X POST localhost:3001/api/games/$GAME/actions \
  -H "Authorization: Bearer $BOB" -H 'Content-Type: application/json' \
  -d '{"action":{"type":"join"}}'
```

Bob's watcher prints a new state after each one. Now Alice chooses rock:

```sh
curl -s -X POST localhost:3001/api/games/$GAME/actions \
  -H "Authorization: Bearer $ALICE" -H 'Content-Type: application/json' \
  -d '{"action":{"type":"choose","choice":"rock"}}'
```

Alice's response includes her own choice. Look at what Bob's watcher printed instead:

```
state #3: {"players":[…],"choices":{},"opponentHasChosen":true,"winner":null}
```

Bob knows Alice has chosen, but not what. That's your `filterStateForPlayer`, applied to every state the server sends to Bob. You can also ask for Bob's view directly:

```sh
curl -s localhost:3001/api/games/$GAME/state/current -H "Authorization: Bearer $BOB"
```

Bob chooses paper:

```sh
curl -s -X POST localhost:3001/api/games/$GAME/actions \
  -H "Authorization: Bearer $BOB" -H 'Content-Type: application/json' \
  -d '{"action":{"type":"choose","choice":"paper"}}'
```

With the round over, the filter reveals both choices, and `winner` holds Bob's player ID:

```
state #4: {"players":[…],"choices":{"e8613a89-…":"rock","7e191c19-…":"paper"},"opponentHasChosen":true,"winner":"7e191c19-…"}
```

## What you built

You wrote about 80 lines of game rules, and got:

- an HTTP API to create games, register players and submit actions
- per-player tokens
- rule enforcement on every action
- a stored history of every state (`#1`–`#4`)
- live, per-player updates over Socket.IO

To clean up, stop the server and watcher with Ctrl-C, then delete `rps-server.ts` and `watch.mjs`.

## Next steps

- [Connect a browser client](../how-to/connect-a-client.md) to a game
- [Hide information from players](../how-to/hide-information-from-players.md) covers filtering in more depth
- [Architecture](../explanation/architecture.md) explains what happens to an action between the request and the broadcast
