# Remote State

A TypeScript library for server-authoritative multiplayer games. Clients dispatch actions, and a server runs the game rules and sends back state updates. The goal is for clients to use that state in their own state library, such as Redux or an alternative, through a middleware; see [Goals](docs/explanation/goals.md). You write the rules of the game: who may join, whether an action is legal, what it does, and what each player may see. Your app, the host, decides who may create and join games. Remote State provides:

- single-use admission codes, exchanged for per-player tokens
- an HTTP API for submitting actions and reading state
- a stored history of every state
- live, per-player updates over Socket.IO, as whole states or as patches
- catch-up over HTTP from an earlier `sequence`, in one patch
- named timers that run actions as the system, such as a turn timeout, and actions from the host
- a standalone server, or a router and socket to mount in your own Express app and HTTP server

```ts
const server = await createRemoteStateServer(myGame, { port: 3000 });

// In your own routes, after your own checks:
const gameId = await server.createGame(newGame());
const code = await server.admit({
  gameId,
  identity: { id: user.id, name: user.name },
});
// The client exchanges the code at POST /api/tokens

await server.startServer();
```

Coding agents can read [llms.txt](packages/remote-state/llms.txt), a manual of the whole library in one file, also shipped in the server package.

## Repository layout

| Path                                                                         | Contents                                                                                          |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| [packages/remote-state](packages/remote-state)                               | The library                                                                                       |
| [packages/remote-state-example-server](packages/remote-state-example-server) | A host serving tic-tac-toe, with a browser client, and battleship side by side, each with a lobby |
| [docs](docs/README.md)                                                       | Documentation                                                                                     |
| [BACKLOG.md](BACKLOG.md)                                                     | Planned work that doesn't depend on open designs                                                  |

## Quick start

Requires Node.js 24 or newer. With [nvm](https://github.com/nvm-sh/nvm), `nvm use` selects it from `.nvmrc`.

```sh
nvm use
npm install --ignore-scripts   # npm would build better-sqlite3 from source otherwise (0064)
npm run start:example   # builds, then serves the tic-tac-toe client on http://localhost:3000
npm test                # all tests: library, e2e and example game engines
```

Then work through the [tutorial](docs/tutorials/build-your-first-game.md).
