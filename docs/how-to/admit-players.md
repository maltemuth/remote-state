# Create games and admit players

The library has no endpoints for creating or joining games: your app, the host, adds its own, after its own login ([0020](../explanation/decisions/0020-hosts-admit-players-through-codes.md)).

1. Your route checks the person, then calls `createGame` or `admit`.
2. `admit` returns a single-use code, which your route returns in the response body.
3. The client exchanges the code at [`POST /api/tokens`](../reference/http-api.md#post-apitokens) for a token.

## Add the routes

```ts
import express from "express";
import {
  createRemoteStateServer,
  UnknownGameError,
} from "@malte.muth/remote-state";

const server = await createRemoteStateServer(myGame, { port: 3000 });

server.app.post("/games", async (req, res) => {
  if (!(await currentUser(req)))
    return void res.status(401).json({ error: "Log in first" });
  res.status(201).json({ gameId: await server.createGame(newGame()) });
});

server.app.post("/games/:gameId/codes", express.json(), async (req, res) => {
  const user = await currentUser(req);
  if (!user) return void res.status(401).json({ error: "Log in first" });
  try {
    const code = await server.admit({
      gameId: req.params.gameId,
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

- `currentUser` stands for your own login. Use any paths outside `/api`.
- The library's JSON parser and error handler cover only `/api`, so add `express.json()`, and your own error handler if your routes' errors should be JSON.
- When [embedded](embed-in-an-existing-app.md), call the same functions on what `createRemoteState` returns.

## Choose the identity

`identity.id` identifies a person within a game; clients never see it. The rest of `identity` goes to the game's `onJoin` as `details`, the first time only.

- **With a login,** use the user's ID. Admitting them again, such as on another device, gives the same player back with a new token.
- **Without one,** generate an ID per person. A client that loses its token then can't get its player back.

A new game has no players: its creator joins with a code too.

## Hand over the code

Return it in the response body, never in a URL. It works once, within a minute (`CODE_LIFETIME_MS`), so issue it right before use. Redeeming it fails with 401 if it's used or expired, and with 403 and the game's reason if `onJoin` refuses the player. A refused code is used up.

## Let players pair another device

With `devicePairing: true`, a player can follow the game on a second device, such as a phone, as the same player, without logging in there ([0063](../explanation/decisions/0063-players-pair-their-own-devices.md)).

On the device they play on, get a code and show a link to it, as a QR code for example. The code goes in the fragment, so it never reaches a server:

```ts
const code = await client.pairingCode();
showQrCode(`${location.origin}/games/${client.session.gameId}/pair#${code}`);
```

On the page the link opens, redeem it and take it out of the address:

```ts
const code = location.hash.slice(1);
history.replaceState(null, "", location.pathname);
const client = createClient({
  session: await redeemCode(code, { baseUrl }),
  baseUrl,
});
```

Show the code only to the player, and only briefly: whoever redeems it within the minute plays as them.
