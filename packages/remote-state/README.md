# @malte.muth/remote-state

Server-authoritative state for multiplayer games. You write the game's rules as a plugin; the library runs them on the server, keeps every game's history, and sends each player their own view of the state, as whole states or as patches.

- **Actions over HTTP, updates over Socket.IO.** Clients send actions; every connected player receives the new state, filtered for what they may see.
- **Hidden information built in.** A view filter decides what each audience sees, such as each player their own hand and spectators neither.
- **Your app stays in charge.** Mount the library in your Express app, or run it standalone. Your app decides who may create and join games, and admits players with single-use codes.
- **Patches for state libraries.** Updates can be Immer patches, which keep unchanged parts of the client's state as the same objects.

Requires Node.js 24 or newer.

## Install

```sh
npm install @malte.muth/remote-state
```

npm 11 may ask whether to allow `better-sqlite3`'s install script. You can deny it: the package ships prebuilt binaries for common platforms, and the library works without the script.

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

The client exchanges the code at `POST /api/tokens` for a token, sends actions to `POST /api/games/:gameId/actions` with `Authorization: Bearer <token>`, and receives updates on the socket with `auth: { gameId, token }`.

## Documentation

The repository's `docs/` folder has a tutorial, how-to guides (connecting clients, embedding in an app, hiding information, persisting and testing games), the full reference, and the design decisions behind the library.

## License

MIT
