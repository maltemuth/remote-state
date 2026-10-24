# @malte.muth/remote-state-client

The client for [`@malte.muth/remote-state`](https://www.npmjs.com/package/@malte.muth/remote-state) spaces: it keeps one member's view in step with the server, and dispatches their actions. Browsers and Node.js 24+.

```sh
npm install @malte.muth/remote-state-client
```

```ts
import { ActionRejectedError, createClient, redeemCode } from '@malte.muth/remote-state-client';

// The code comes from your host, which decides who may play
const session = await redeemCode(code, { baseUrl: '/tic-tac-toe' });
const client = createClient<TicTacToeView, TicTacToeAction>({ session, baseUrl: '/tic-tac-toe' });

client.subscribe(({ view }) => render(view)); // also after your own actions
client.onConnection(({ status }) => showConnection(status));

try {
  await client.dispatch({ type: 'place', row: 1, col: 1 });
} catch (error) {
  if (error instanceof ActionRejectedError) showError(error.message);
}
```

Views are frozen, and unchanged parts keep their identity, so `useSyncExternalStore(client.subscribe, client.getSnapshot)` works in React. The client catches up by itself after reconnects and missed updates.

Documentation: the repository's `docs/`, and `llms.txt` in `@malte.muth/remote-state` for coding agents.

## License

MIT
