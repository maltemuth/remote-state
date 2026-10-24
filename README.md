# Remote State

Like Redux, but the store lives on the server and every player is connected to it.

Clients dispatch actions. The server runs your game's rules, like a reducer, and sends each player the new state. A player sees only what your filter lets them see, so hidden hands stay hidden.

![Alice and Bob each send actions to the server. Your rules turn the current state and an action into the new state; your filter turns the state into each player's own view, which goes back to that player.](docs/how-it-works.svg)

Your app decides who may play, and the library does the rest: storing every game and its history, ordering actions, and keeping every client in step.

```ts
const server = await createRemoteStateServer(myGame, { port: 3000 });

// In your own route, after your own login:
const gameId = await server.createGame(newGame());
const code = await server.admit({
  gameId,
  identity: { id: user.id, name: user.name },
});
// The client trades the code for a token, then plays

await server.startServer();
```

You get admission codes and tokens, actions over HTTP, per-player views over Socket.IO as whole states or patches, a stored history, catch-up, timers, and a standalone server or a router for your own Express app.

## Try it

Node.js 24 or newer (`nvm use`):

```sh
npm install --ignore-scripts   # or npm builds the SQLite driver from source (0064)
npm run start:example          # tic-tac-toe on http://localhost:3000
npm test
```

Then build your own game in the [tutorial](docs/tutorials/build-your-first-game.md).

## Where things are

- [packages/remote-state](packages/remote-state): the server library
- [packages/remote-state-client](packages/remote-state-client): the client
- [packages/remote-state-example-server](packages/remote-state-example-server): tic-tac-toe and battleship, each with a lobby
- [docs](docs/README.md): documentation; [llms.txt](packages/remote-state/llms.txt) for coding agents
- [BACKLOG.md](BACKLOG.md): planned work
