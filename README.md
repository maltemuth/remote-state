# Remote State

Like Redux, Pinia or NgRx, but the store lives on the server and every user is connected to it.

Clients dispatch actions. The server runs your rules, like a reducer, and sends each user the new state.

![Alice and Bob each send actions to the server. Your rules turn the current state and an action into the new state; your filter turns the state into each user's own view, which goes back to that user.](docs/how-it-works.svg)

The full state never leaves the server. A client only ever receives what your filter lets its user see, so anything private, such as a sealed bid, a hand of cards or someone else's draft, stays hidden, even from the browser's dev tools. And clients can't change the state themselves: an action your rules reject changes nothing, its sender gets the reason, and nobody else sees a thing.

```ts
const server = await createRemoteStateServer(myRules, { port: 3000 });

// In your own route, after your own login:
const spaceId = await server.createSpace(initialState);
const code = await server.admit({
  spaceId,
  identity: { id: user.id, name: user.name },
});
// The client trades the code for a token, then connects

await server.startServer();
```

Each shared state is a **space**, and the people in it its **members**. You get admission codes and tokens, actions over HTTP, per-member views over Socket.IO as whole states or patches, a stored history, catch-up, timers, and a standalone server or a router for your own Express app.

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
