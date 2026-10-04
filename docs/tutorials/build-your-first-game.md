# Build your first game: rock, paper, scissors

In this tutorial you build a two-player rock-paper-scissors server with Remote State, play a round from the command line, and watch the updates arrive live over Socket.IO.

Along the way you'll see the four things a Remote State game does:

- **join** players, so the game decides who gets a seat
- **validate** actions, so players can only make legal moves
- **execute** actions, turning the current state into the next one
- **filter** state, so each player only sees what they're allowed to see

The filter matters in this game: you must not see your opponent's choice before you make your own.

You'll also write a small **host**: the part of your app that creates games and lets people in. Remote State has no endpoints for that, because only your app knows who may play.

Allow about 30 minutes.

## Before you start

You need Node.js 24 or newer, `curl`, and a clone of this repository with dependencies installed:

```sh
npm install
```

You'll write the game inside the example server package, which is already set up to use the library.

## 1. Describe the game's state and actions

Create `packages/remote-state-example-server/src/rps-server.ts` and start with the imports and types:

```ts
import { randomUUID } from "crypto";
import {
  createRemoteStateServer,
  GameRefusal,
  UnknownGameError,
  type GamePlugin,
} from "@malte.muth/remote-state";

type Choice = "rock" | "paper" | "scissors";

// Everything the server knows about a game
interface RpsState {
  players: string[];
  names: Record<string, string>;
  choices: Record<string, Choice>;
  winner: string | null;
}

// What players can ask the server to do
type RpsAction = { type: "choose"; choice: Choice };

// What a single player gets to see
interface RpsView {
  players: string[];
  names: Record<string, string>;
  choices: Record<string, Choice>;
  opponentHasChosen: boolean;
  winner: string | null;
}

const beats: Record<Choice, Choice> = {
  rock: "scissors",
  paper: "rock",
  scissors: "paper",
};

const newGame = (): RpsState => ({
  players: [],
  names: {},
  choices: {},
  winner: null,
});
```

There are separate state and view types because the server keeps the whole truth (`RpsState`) but hands each player a view of it (`RpsView`).

`newGame` builds the state a game starts with. The library doesn't call it; your host will, when it creates a game.

## 2. Write the rules

Add the game plugin below the types. Remote State calls these functions and handles everything else:

```ts
const rockPaperScissors: GamePlugin<RpsState, RpsAction, RpsView> = {
  onJoin: (state, { playerId, details }) => {
    if (state.players.length === 2) throw new GameRefusal("Game is full");
    return {
      ...state,
      players: [...state.players, playerId],
      names: { ...state.names, [playerId]: String(details.name ?? "") },
    };
  },

  validateAction: (state, action, playerId) => {
    if (action?.type !== "choose") return "Unknown action";
    if (state.players.length < 2) return "Waiting for an opponent";
    if (state.choices[playerId]) return "You already chose";
    if (!(action.choice in beats)) return "Choose rock, paper or scissors";
    return true;
  },

  executeAction: (state, action, playerId) => {
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

  // Each player is an audience of their own, named by their player ID
  filterStateForAudience: (state, playerId) => {
    const opponent = state.players.find((id) => id !== playerId);
    const finished = state.winner !== null;
    return {
      players: state.players,
      names: state.names,
      // Reveal every choice once the round is over, until then only your own
      choices: finished
        ? state.choices
        : Object.fromEntries(
            Object.entries(state.choices).filter(([id]) => id === playerId),
          ),
      opponentHasChosen: opponent !== undefined && opponent in state.choices,
      winner: state.winner,
    };
  },
};
```

`onJoin` runs when someone enters the game for the first time. It seats them, or throws a `GameRefusal` to turn them away. `details` is whatever your host said about the person; here, their name.

`validateAction` returns `true` to accept an action, or a message explaining why it's rejected. `executeAction` only ever sees actions that passed validation.

`filterStateForAudience` turns the full state into what one audience may see. By default, every player is an audience of their own, named by their player ID, so here the audience is simply the player.

## 3. Start the server and add the host routes

Add the rest of the file:

```ts
const server = await createRemoteStateServer(rockPaperScissors, 3001);

// Host routes: anyone may create a game and get a code to join it
server.app.post("/lobby/games", async (_req, res) => {
  const gameId = await server.createGame(newGame());
  res.status(201).json({ gameId });
});

server.app.post("/lobby/games/:gameId/codes", async (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name : "";
  try {
    const code = await server.admit({
      gameId: req.params.gameId,
      identity: { id: randomUUID(), name },
    });
    res.status(201).json({ code });
  } catch (err) {
    if (!(err instanceof UnknownGameError)) throw err;
    res.status(404).json({ error: err.message });
  }
});

await server.startServer();
```

These two routes are your host. `createGame` stores a new game with the state you pass it. `admit` returns a single-use code that lets one person into a game. The `identity` says who that person is: an `id` of your choosing, and any details for the game. This host has no login, so every request gets a new ID and counts as a new person. A real app would check its own users here.

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

## 4. Create a game and let Alice in

Create a game through your host:

```sh
curl -s -X POST localhost:3001/lobby/games
```

```json
{ "gameId": "f26f393a-…" }
```

Copy the ID into a shell variable so the next commands are shorter:

```sh
export GAME=<gameId from the response>
```

Ask the host for a code for Alice:

```sh
curl -s -X POST localhost:3001/lobby/games/$GAME/codes \
  -H 'Content-Type: application/json' -d '{"name":"Alice"}'
```

```json
{ "code": "d55aef3f…" }
```

A code is valid for one minute, so exchange it for a token straight away. This is the library's own endpoint, the one a client calls:

```sh
curl -s -X POST localhost:3001/api/tokens \
  -H 'Content-Type: application/json' -d '{"code":"<code from the response>"}'
```

```json
{ "gameId": "f26f393a-…", "playerId": "d8c2746c-…", "token": "c2cd5a54…" }
```

Exchanging the code ran your `onJoin`, so Alice now has a seat. The token is her password for this game:

```sh
export ALICE=<token from the response>
```

Run the same `curl` again with the same code:

```json
{ "error": "Invalid, used or expired code" }
```

Each code works once.

## 5. Let Bob in, and turn Carol away

Alice tries to choose before she has an opponent:

```sh
curl -s -X POST localhost:3001/api/games/$GAME/actions \
  -H "Authorization: Bearer $ALICE" -H 'Content-Type: application/json' \
  -d '{"action":{"type":"choose","choice":"rock"}}'
```

```json
{ "error": "Waiting for an opponent" }
```

That's your `validateAction` at work. Get a code for Bob with `{"name":"Bob"}`, exchange it at `/api/tokens` as before, and keep his token:

```sh
export BOB=<token from Bob's response>
```

Now the game is full. Get a code for a third person, Carol, and exchange it:

```json
{ "error": "Game is full" }
```

The status is 403. That's the `GameRefusal` from your `onJoin`. Carol gets no token, and her code is used up.

## 6. Watch the game live

Every change to the game is pushed to connected players over Socket.IO. Create `watch.mjs` in the repository root:

```js
import { io } from "socket.io-client";

const [gameId, token] = process.argv.slice(2);
const socket = io("http://localhost:3001", { auth: { gameId, token } });

socket.on("connect", () => console.log("connected"));
socket.on("connect_error", (error) => console.log("refused:", error.message));
socket.on("state", (event) =>
  console.log(`state #${event.sequence}:`, JSON.stringify(event.state)),
);
```

Run it as Bob in a third terminal:

```sh
node watch.mjs $GAME $BOB
```

It prints `connected`, and then Bob's current view straight away:

```
state #2: {"players":[…],"names":{…},"choices":{},"opponentHasChosen":false,"winner":null}
```

The `sequence` counts the game's states. The new game was state 0, and each join added one.

## 7. Play a round

Alice chooses rock:

```sh
curl -s -X POST localhost:3001/api/games/$GAME/actions \
  -H "Authorization: Bearer $ALICE" -H 'Content-Type: application/json' \
  -d '{"action":{"type":"choose","choice":"rock"}}'
```

```json
{ "sequence": 3 }
```

The response only confirms the action and says which state it produced. The state itself goes out over the socket. Look at what Bob's watcher printed:

```
state #3: {"players":[…],"names":{…},"choices":{},"opponentHasChosen":true,"winner":null}
```

Bob knows Alice has chosen, but not what. That's your `filterStateForAudience`, applied to every state the server sends to Bob. You can also ask for Bob's view directly:

```sh
curl -s localhost:3001/api/games/$GAME/state -H "Authorization: Bearer $BOB"
```

```json
{"gameId":"f26f393a-…","sequence":3,"state":{"players":[…],"names":{…},"choices":{},"opponentHasChosen":true,"winner":null}}
```

Bob chooses paper:

```sh
curl -s -X POST localhost:3001/api/games/$GAME/actions \
  -H "Authorization: Bearer $BOB" -H 'Content-Type: application/json' \
  -d '{"action":{"type":"choose","choice":"paper"}}'
```

With the round over, the filter reveals both choices, and `winner` holds Bob's player ID:

```
state #4: {"players":[…],"names":{…},"choices":{"d8c2746c-…":"rock","ce7b2494-…":"paper"},"opponentHasChosen":true,"winner":"ce7b2494-…"}
```

Finally, ask what changed for Bob since state 2, when his watcher connected:

```sh
curl -s "localhost:3001/api/games/$GAME/updates?since=2" -H "Authorization: Bearer $BOB"
```

```json
{"gameId":"f26f393a-…","since":2,"sequence":4,"patches":[{"op":"replace","path":["opponentHasChosen"],"value":true},…]}
```

These are patches from Bob's view at state 2 to his view now. A client that was offline can catch up this way without fetching the whole state.

## What you built

You wrote about 100 lines of game rules and host routes, and got:

- single-use codes that let people into a game, and per-player tokens
- seating rules, enforced when someone joins
- rule enforcement on every action
- a stored history of every state (`#0`–`#4`)
- live, per-player updates over Socket.IO, and catch-up over HTTP

To clean up, stop the server and watcher with Ctrl-C, then delete `rps-server.ts` and `watch.mjs`.

## Next steps

- [Create games and admit players](../how-to/admit-players.md) from your own app
- [Connect a browser client](../how-to/connect-a-client.md) to a game
- [Hide information from players](../how-to/hide-information-from-players.md) covers filtering and audiences in more depth
- [Architecture](../explanation/architecture.md) explains what happens to an action between the request and the update
