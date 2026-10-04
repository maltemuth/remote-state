# @malte.muth/remote-state-client

The client for [`@malte.muth/remote-state`](https://www.npmjs.com/package/@malte.muth/remote-state) games. It keeps one player's view of a game in step with the server, and sends the player's actions. It doesn't depend on a state library: anything can subscribe to the view, including React's `useSyncExternalStore`.

- **Whole views, kept in step.** The client receives patches, applies them with Immer, and hands out the player's whole view. Unchanged parts keep their identity, and views are frozen.
- **Catches up by itself.** After reconnects and missed updates, it fetches what changed since the view it has.
- **Typed by your game.** Pass your game's view and action types, and `send` and the view are checked.

Works in browsers and in Node.js 24 or newer.

## Install

```sh
npm install @malte.muth/remote-state-client
```

## Example

```ts
import { ActionRejectedError, createClient, redeemCode } from '@malte.muth/remote-state-client';
import type { TicTacToeAction, TicTacToeView } from './game-types';

// The code comes from your host, which decides who may play
const session = await redeemCode(code, { baseUrl: '/tic-tac-toe' });

const client = createClient<TicTacToeView, TicTacToeAction>({ session, baseUrl: '/tic-tac-toe' });
client.subscribe(({ view }) => render(view));
client.onConnection(({ status }) => showConnection(status));

try {
  await client.send({ type: 'place', row: 1, col: 1 });
} catch (error) {
  if (error instanceof ActionRejectedError) showError(error.message);
}
```

The new view arrives through `subscribe`, for the player who acted as for everyone else.

## Documentation

The repository's `docs/` folder has a how-to guide for connecting a browser client, including without a bundler, and the full client API reference.

## License

MIT
