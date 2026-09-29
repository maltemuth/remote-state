# Remote State

A TypeScript library for server-authoritative multiplayer games. You write the rules of the game: validate an action, apply it, and decide what each player may see. Remote State provides:

- an HTTP API for creating games, registering players and submitting actions
- per-player tokens
- a stored history of every state
- live, per-player updates over Socket.IO

```ts
const server = await createRemoteStateServer(myGame, 3000);
await server.startServer();
```

## Repository layout

| Path | Contents |
|---|---|
| [packages/remote-state](packages/remote-state) | The library |
| [packages/remote-state-example-server](packages/remote-state-example-server) | Tic-tac-toe with a browser client, and a battleship game plugin |
| [docs](docs/README.md) | Documentation |

## Quick start

Requires Node.js 24 or newer. With [nvm](https://github.com/nvm-sh/nvm), `nvm use` selects it from `.nvmrc`.

```sh
nvm use
npm install
npm run start:example   # builds, then serves tic-tac-toe on http://localhost:3000
npm test                # all tests: library, e2e and example game engines
```

Then work through the [tutorial](docs/tutorials/build-your-first-game.md).
