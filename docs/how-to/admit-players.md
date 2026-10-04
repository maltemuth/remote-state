# Create games and admit players

Remote State has no endpoints for creating or joining games. Your app is the host: it decides who may do either, and calls the library in the same process. This guide shows the routes a host adds. For why it works this way, see [0020](../explanation/decisions/0020-hosts-admit-players-through-codes.md) and [0023](../explanation/decisions/0023-no-server-to-server-admit.md).

The flow is:

1. Your route checks the person against your own login, then calls `server.createGame` or `server.admit`.
2. `admit` returns a single-use code, which your route returns to the client in the response body.
3. The client exchanges the code at [`POST /api/tokens`](../reference/http-api.md#post-apitokens) for a token, and uses the library's API from then on.

## Add the routes

```ts
import {
  createRemoteStateServer,
  UnknownGameError,
} from "@malte.muth/remote-state";

const server = await createRemoteStateServer(myGame, { port: 3000 });

server.app.post("/games", async (req, res) => {
  const user = await currentUser(req);
  if (!user) {
    res.status(401).json({ error: "Log in first" });
    return;
  }
  const gameId = await server.createGame(newGame());
  res.status(201).json({ gameId });
});

server.app.post("/games/:gameId/codes", async (req, res) => {
  const user = await currentUser(req);
  if (!user) {
    res.status(401).json({ error: "Log in first" });
    return;
  }
  const { gameId } = req.params;
  if (!(await mayJoin(user, gameId))) {
    res.status(403).json({ error: "You're not invited" });
    return;
  }
  try {
    const code = await server.admit({
      gameId,
      identity: { id: user.id, name: user.name },
    });
    res.status(201).json({ code });
  } catch (err) {
    if (!(err instanceof UnknownGameError)) throw err;
    res.status(404).json({ error: err.message });
  }
});

await server.startServer();
```

`currentUser` and `mayJoin` stand for your own login and rules. Use any paths outside `/api`, which the library reserves. If you [embed the library in your own app](embed-in-an-existing-app.md), add the same routes there, and call `createGame` and `admit` on what `createRemoteState` returns.

The library's JSON body parser and error handler apply only to `/api`. If your routes read a JSON body, add `express.json()` to them. Errors you don't handle get Express's default response, an HTML page with status 500. Add your own error handler after your routes if clients need JSON.

## Create a game

Pass `createGame` the state the game starts in. Build it with a function from your game, such as `newTicTacToeGame()` in the example. The library stores it as state 0 and doesn't check it ([0036](../explanation/decisions/0036-hosts-pass-the-initial-state.md)).

A new game has no players. The person who created it joins like everyone else, with a code.

## Choose the identity

`identity.id` is how the library recognizes a person within a game. It's never shown to clients.

- **With a login,** use your user ID. When the same user is admitted again, for example on another device, they get the same player back, with a new token. Their old tokens stay valid ([0019](../explanation/decisions/0019-several-tokens-per-player.md)).
- **Without a login,** generate a new ID per request, as the example's [lobby](../../packages/remote-state-example-server/src/host/lobby.ts) does. Every code is then a new player, and a client that loses its token can't get its player back.

Everything else in `identity` is passed to the game's `onJoin` as `details`, for example a display name. The game decides what to keep in its state. `onJoin` runs only the first time an identity joins a game, so later admissions don't change those details.

## Hand over the code

Return the code in the response body. Never put it in a URL, where it ends up in logs and browser history.

The code is valid for one minute (`CODE_LIFETIME_MS`), so issue it when the client is about to use it, not ahead of time. Exchanging it can fail:

| Status | Meaning                                                                                  | What the client can do      |
| ------ | ---------------------------------------------------------------------------------------- | --------------------------- |
| 401    | The code is unknown, used or expired                                                     | Ask your host for a new one |
| 403    | The game refused the player, for example because it's full; `error` is the game's reason | Show the reason             |

A refused code is used up too, so a client can't retry with it.

## Errors from the host API

| Call         | Throws             | When                              |
| ------------ | ------------------ | --------------------------------- |
| `createGame` | `Error`            | The initial state is `undefined`  |
| `admit`      | `UnknownGameError` | The game doesn't exist            |
| `admit`      | `Error`            | `identity.id` is missing or empty |

See [Server API](../reference/server-api.md#remotestateserver) for the full signatures.
