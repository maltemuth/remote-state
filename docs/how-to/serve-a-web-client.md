# Serve a web client

`createRemoteStateServer` returns the Express app, so you can add static files and your own routes before starting it. Only `/api` is reserved.

```ts
import express from "express";
import process from "process";
import { createRemoteStateServer } from "@malte.muth/remote-state";

const port = Number(process.env.PORT ?? 3000);
const server = await createRemoteStateServer(myGame, port);

server.app.use(express.static("public"));
server.app.get("/rules", (_req, res) => res.send("First to three in a row wins."));

process.on("SIGINT", () => server.shutdown());
process.on("SIGTERM", () => server.shutdown());

await server.startServer();
```

The page can then load Socket.IO from `/socket.io/socket.io.js` and use relative API URLs. See [Connect a browser client](connect-a-client.md).

The example server is this setup with a full tic-tac-toe client. Run it from the repository root:

```sh
npm run start:example
```

Then open http://localhost:3000 and use the invite link in a second tab.

## Add server-side events

To push something other than state, such as a chat message, use the socket manager:

```ts
server.app.post("/games/:gameId/chat", (req, res) => {
  server.socketIOManager?.broadcastToGame(req.params.gameId, "chat", req.body);
  res.sendStatus(204);
});
```

Routes you add aren't authenticated. If they need a player identity, check the token yourself.
