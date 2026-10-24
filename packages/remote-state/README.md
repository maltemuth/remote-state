# @malte.muth/remote-state

Server-authoritative shared state, on Node.js 24+: like Redux, Pinia or NgRx, but on the server. Each shared state is a **space**, such as a game, an auction or a document, and the people in it are its **members**. You write the rules; the library runs them, stores every space's history, and sends each member their own view, live. Your app decides who may join.

```sh
npm install @malte.muth/remote-state
```

From a lockfile, install with `npm ci --ignore-scripts`: otherwise npm tries to build the SQLite driver, `better-sqlite3`, from source, though it ships prebuilt binaries ([npm/cli#9859](https://github.com/npm/cli/pull/9859)).

## Example

```ts
import { createRemoteStateServer, Refusal, type Rules } from '@malte.muth/remote-state';

interface Counter {
  count: number;
  members: string[];
}

const counter: Rules<Counter, { type: 'increment' }> = {
  onJoin: (state, { memberId }) => {
    if (state.members.length >= 2) throw new Refusal('Two people are counting already');
    return { ...state, members: [...state.members, memberId] };
  },
  validateAction: (state, _action, memberId) =>
    state.members.includes(memberId) || 'Only members can count',
  executeAction: state => ({ ...state, count: state.count + 1 }),
};

const server = await createRemoteStateServer(counter, { port: 3000 });

// Your routes decide who joins, then hand the client a single-use code
server.app.post('/counters', async (_req, res) => {
  res.json({ spaceId: await server.createSpace({ count: 0, members: [] }) });
});
server.app.post('/counters/:spaceId/codes', async (req, res) => {
  const code = await server.admit({
    spaceId: req.params.spaceId,
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
