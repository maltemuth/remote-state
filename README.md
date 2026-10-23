# Remote State

Server-authoritative multiplayer games in TypeScript. You write a game's rules; clients send actions, the server applies them, and each player gets their own view of the result, live.

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
