# Serve a web client

`createRemoteStateServer` returns the Express app, so you can add static files and your own routes before starting it. Only `/api` is reserved.

```ts
import express from "express";
import process from "process";
import { createRemoteStateServer } from "@malte.muth/remote-state";

const server = await createRemoteStateServer(myGame, {
  port: Number(process.env.PORT ?? 3000),
});

server.app.use(express.static("public"));
server.app.get("/rules", (_req, res) =>
  res.send("First to three in a row wins."),
);

const stop = async () => {
  await server.close();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

await server.startServer();
```

The page can then use the client package with relative URLs. Serve the package with your bundle, or as ES modules next to the page; see [Connect a browser client](connect-a-client.md).

The client also needs a way to create and join games, which your host provides with its own routes on the same app. See [Create games and admit players](admit-players.md).

To serve the client and the game from an Express app you already have, see [Embed in an existing app](embed-in-an-existing-app.md).

The example server does the same from its own app, with a full tic-tac-toe client and the game under `/tic-tac-toe`. Run it from the repository root:

```sh
npm run start:example
```

Then open http://localhost:3000, start a game, and open the invite link in a second tab.

Routes you add aren't authenticated by the library. If they need to know the player, use your own login.
