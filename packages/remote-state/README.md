# @malte.muth/remote-state

Server-authoritative state for multiplayer games. You write the game's rules as a plugin; the library runs them on the server, keeps every game's history, and sends each player their own view of the state, as whole states or as patches.

- **Actions over HTTP, updates over Socket.IO.** Clients send actions; every connected player receives the new state, filtered for what they may see.
- **Hidden information built in.** A view filter decides what each audience sees, such as each player their own hand and spectators neither.
- **Your app stays in charge.** Mount the library in your Express app, or run it standalone. Your app decides who may create and join games, and admits players with single-use codes.
- **Time limits and actions from the server.** A game can schedule actions, such as a turn timeout, and your app can act in a game as the system.
- **Patches for state libraries.** Updates can be Immer patches, which keep unchanged parts of the client's state as the same objects.

Requires Node.js 24 or newer.

## Install

```sh
npm install @malte.muth/remote-state
```

The SQLite driver, `better-sqlite3`, ships prebuilt binaries for common platforms and needs no install script. When installing from a lockfile, such as with `npm ci`, npm still tries to build it from source, which fails without a C++ compiler. Install with `--ignore-scripts` until npm fixes this ([npm/cli#9859](https://github.com/npm/cli/pull/9859)):

```sh
npm ci --ignore-scripts
```

## Example

```ts
import { createRemoteStateServer, GameRefusal, type GamePlugin } from '@malte.muth/remote-state';

interface Counter {
  count: number;
  players: string[];
}

const counter: GamePlugin<Counter, { type: 'increment' }> = {
  onJoin: (state, { playerId }) => {
    if (state.players.length >= 2) throw new GameRefusal('The game is full');
    return { ...state, players: [...state.players, playerId] };
  },
  validateAction: (state, _action, playerId) =>
    state.players.includes(playerId) || 'Only players can count',
  executeAction: state => ({ ...state, count: state.count + 1 }),
};

const server = await createRemoteStateServer(counter, { port: 3000 });

// Your routes decide who plays, then hand the client a single-use code
server.app.post('/games', async (_req, res) => {
  res.json({ gameId: await server.createGame({ count: 0, players: [] }) });
});
server.app.post('/games/:gameId/codes', async (req, res) => {
  const code = await server.admit({
    gameId: req.params.gameId,
    identity: { id: crypto.randomUUID() },
  });
  res.json({ code });
});

await server.startServer();
```

In the browser, [`@malte.muth/remote-state-client`](https://www.npmjs.com/package/@malte.muth/remote-state-client) exchanges the code for a session, keeps the player's view in step, and sends actions. Clients can also talk to the HTTP API and the socket directly: the code is exchanged at `POST /api/tokens` for a token, actions go to `POST /api/games/:gameId/actions` with `Authorization: Bearer <token>`, and updates arrive on the socket with `auth: { gameId, token }`.

## Documentation

For coding agents, `llms.txt` in this package is a manual of the whole library in one file: the model, both packages' APIs, a server and a client, and the common mistakes.

The repository's `docs/` folder has a tutorial, how-to guides (connecting clients, embedding in an app, hiding information, scheduling actions, persisting and testing games), the full reference, and the design decisions behind the library.

## License

MIT
