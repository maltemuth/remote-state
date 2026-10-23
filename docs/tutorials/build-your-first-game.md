# Build your first game: rock, paper, scissors

You'll build a two-player rock-paper-scissors server, play a round with `curl`, and watch the updates arrive over Socket.IO. About 30 minutes.

You need Node.js 24 or newer, `curl`, and a clone of this repository, installed with:

```sh
npm install --ignore-scripts
```

(Without the flag, npm tries to build the SQLite driver from source; [0064](../explanation/decisions/0064-install-without-scripts.md).)

## 1. The state, actions and view

Create `packages/remote-state-example-server/src/rps-server.ts`:

```ts
import { randomUUID } from "crypto";
import express from "express";
import {
  createRemoteStateServer,
  GameRefusal,
  UnknownGameError,
  type GamePlugin,
} from "@malte.muth/remote-state";

type Choice = "rock" | "paper" | "scissors";

// Everything the server knows
interface RpsState {
  players: string[];
  names: Record<string, string>;
  choices: Record<string, Choice>;
  winner: string | null;
}

// What players may ask for
type RpsAction = { type: "choose"; choice: Choice };

// What one player sees
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

The server keeps the whole truth, `RpsState`, and gives each player a view of it, `RpsView`.

## 2. The rules

Add the game:

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
    return {
      players: state.players,
      names: state.names,
      // Every choice once the round is over; until then, only your own
      choices:
        state.winner !== null
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

- `onJoin` seats a newcomer, or turns them away with a `GameRefusal`.
- `validateAction` returns `true`, or why not.
- `executeAction` turns the state into the next one.
- `filterStateForAudience` decides what each player sees.

## 3. The server and your host's routes

Remote State has no routes for creating or joining games: only your app knows who may play. Add two:

```ts
const server = await createRemoteStateServer(rockPaperScissors, { port: 3001 });

server.app.post("/lobby/games", async (_req, res) => {
  res.status(201).json({ gameId: await server.createGame(newGame()) });
});

server.app.post(
  "/lobby/games/:gameId/codes",
  express.json(),
  async (req, res) => {
    const name = typeof req.body?.name === "string" ? req.body.name : "";
    try {
      // No login here, so every request is a new person
      const code = await server.admit({
        gameId: req.params.gameId,
        identity: { id: randomUUID(), name },
      });
      res.status(201).json({ code });
    } catch (err) {
      if (!(err instanceof UnknownGameError)) throw err;
      res.status(404).json({ error: err.message });
    }
  },
);

await server.startServer();
```

Build and run it, and leave it running:

```sh
npm run build
node packages/remote-state-example-server/dist/rps-server.js
```

## 4. Let Alice in

In a second terminal, create a game and keep its ID:

```sh
curl -s -X POST localhost:3001/lobby/games
export GAME=<gameId>
```

Get a code for Alice, and trade it for a token at the library's own endpoint, within a minute:

```sh
curl -s -X POST localhost:3001/lobby/games/$GAME/codes -H 'Content-Type: application/json' -d '{"name":"Alice"}'
curl -s -X POST localhost:3001/api/tokens -H 'Content-Type: application/json' -d '{"code":"<code>"}'
export ALICE=<token>
```

That ran your `onJoin`: Alice has a seat. Trade the same code again, and it's refused: codes work once.

## 5. Bob joins, Carol doesn't

Alice tries to play alone:

```sh
curl -s -X POST localhost:3001/api/games/$GAME/actions \
  -H "Authorization: Bearer $ALICE" -H 'Content-Type: application/json' \
  -d '{"action":{"type":"choose","choice":"rock"}}'
```

```json
{ "error": "Waiting for an opponent" }
```

Let Bob in the same way as Alice, with `{"name":"Bob"}`, and `export BOB=<token>`. Then try Carol: her token request answers 403 `Game is full`.

## 6. Watch live

Create `watch.mjs` in the repository root:

```js
import { io } from "socket.io-client";

const [gameId, token] = process.argv.slice(2);
const socket = io("http://localhost:3001", { auth: { gameId, token } });
socket.on("state", (event) =>
  console.log(`#${event.sequence}`, JSON.stringify(event.state)),
);
```

Run it as Bob in a third terminal, `node watch.mjs $GAME $BOB`. It prints his view at once, at sequence 2: the new game was 0, and each join added one.

## 7. Play

Alice chooses rock, with the `curl` from step 5. It answers `{ "sequence": 3 }`, and Bob's watcher prints:

```
#3 {"players":[…],"names":{…},"choices":{},"opponentHasChosen":true,"winner":null}
```

Bob knows Alice chose, but not what: that's your filter. Now Bob chooses paper (the same `curl` with `$BOB` and `"paper"`). The round is over, so the filter shows both choices, and `winner` is Bob's player ID.

Last, ask what changed for Bob since sequence 2:

```sh
curl -s "localhost:3001/api/games/$GAME/updates?since=2" -H "Authorization: Bearer $BOB"
```

One set of patches from his view then to his view now: how a client that was away catches up.

## What you built

About 100 lines gave you admission codes and tokens, seating rules, checked actions, a stored history, private views, live updates and catch-up. Stop both processes with Ctrl-C, and delete `rps-server.ts` and `watch.mjs`.

Next: [connect a browser client](../how-to/connect-a-client.md), or see [how an action travels](../explanation/architecture.md).
