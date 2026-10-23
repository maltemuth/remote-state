# @malte.muth/remote-state

Server-authoritative state for multiplayer games, on Node.js 24+. You write the rules as a plugin; the library runs them, stores every game's history, and sends each player their own view, live. Your app decides who may play.

```sh
npm install @malte.muth/remote-state
```

From a lockfile, install with `npm ci --ignore-scripts`: otherwise npm tries to build the SQLite driver, `better-sqlite3`, from source, though it ships prebuilt binaries ([npm/cli#9859](https://github.com/npm/cli/pull/9859)).

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

Clients use [`@malte.muth/remote-state-client`](https://www.npmjs.com/package/@malte.muth/remote-state-client), or the HTTP API and socket directly.

Documentation: the repository's `docs/`, and, for coding agents, `llms.txt` in this package.

## License

MIT
