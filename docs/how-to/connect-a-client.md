# Connect a client

Use `@malte.muth/remote-state-client` to get a session, show the member's view and dispatch actions. [public/client.js](../../packages/remote-state-example-server/public/client.js) in the example server is a complete page. Every option is in the [Client API](../reference/client-api.md).

## Load the package

With a bundler: `npm install @malte.muth/remote-state-client`.

Without one, serve it and its two dependencies as ES modules, with an import map:

```html
<script type="importmap">
  {
    "imports": {
      "@malte.muth/remote-state-client": "/modules/remote-state-client/index.js",
      "immer": "/modules/immer.mjs",
      "socket.io-client": "/modules/socket.io-client.mjs"
    }
  }
</script>
```

The example serves them from the installed packages: the client's `dist`, `immer/dist/immer.production.mjs` and `socket.io-client/dist/socket.io.esm.min.js` ([browserModules.ts](../../packages/remote-state-example-server/src/host/browserModules.ts)).

## Join, show the view, dispatch actions

```js
import {
  ActionRejectedError,
  createClient,
  redeemCode,
} from "@malte.muth/remote-state-client";

// A code from your host's own route; see Create spaces and admit members
const session = await redeemCode(code); // { spaceId, memberId, token }
sessionStorage.setItem(`space:${session.spaceId}`, JSON.stringify(session));

const client = createClient({ session });
client.subscribe(({ view }) => render(view));
client.onConnection((connection) => showStatus(connection.status));

try {
  await client.dispatch({ type: "place", row: 1, col: 1 });
} catch (error) {
  if (error instanceof ActionRejectedError) showError(error.message);
  else throw error;
}
```

- **Keep the session.** The server can't hand out the token again. `sessionStorage` gives each tab its own member, which helps when testing; `localStorage` survives restarts.
- **Render from `subscribe` only.** `dispatch` resolves with the action's `sequence`, but the new view arrives through `subscribe`, like everyone else's ([0033](../explanation/decisions/0033-no-optimistic-updates.md)). `await client.waitFor(sequence)` waits for it.
- **Views are frozen,** and unchanged parts keep their identity. In React: `useSyncExternalStore(client.subscribe, client.getSnapshot)`.
- **Type it** with your rules' types, `createClient<View, Action>({ session })`, from a module that doesn't import the server.

## Under a prefix or on another origin

Pass where the library's routes are as `baseUrl`, to both `redeemCode` and `createClient`: `/tic-tac-toe`, or `https://games.example.com/tic-tac-toe`. The library allows every origin unless the server's [`cors` option](../reference/server-api.md#options) says otherwise; your own routes need their own CORS.

## Serve the page from the game server

`server.app` is an Express app; only `/api` is reserved:

```ts
server.app.use(express.static("public"));
```

The example server does this, with the game under `/tic-tac-toe`: run `npm run start:example`, open http://localhost:3000, and open the invite link in a second tab.

## Without the package

1. `POST /api/tokens` with `{ code }`, for the token.
2. Connect Socket.IO with `auth: { spaceId, token }`, and optionally `query: { format: "immer" }`. Every (re)connect starts with a whole `state` event; a `state` or `patches` event follows each change.
3. `POST /api/spaces/:spaceId/actions` with `{ action }` and `Authorization: Bearer <token>`: 201 `{ sequence }`, or 400 with the rules' reason.
4. After missing updates, `GET /api/spaces/:spaceId/updates?since=<sequence>`.

See the [HTTP API](../reference/http-api.md) and [Socket.IO events](../reference/socket-events.md).
