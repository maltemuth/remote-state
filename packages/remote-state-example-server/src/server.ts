/**
 * Example usage of the Remote State Server with Tic-Tac-Toe
 *
 * This file demonstrates how to create and start a tic-tac-toe server
 * using the factory function approach with Socket.IO support.
 */

import { createTicTacToeServer } from "./server-config.js";
import { createLogger } from "@malte.muth/remote-state";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

// Get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { info } = createLogger({
  scope: "example-server",
});

// Create and start the tic-tac-toe server with persistent database
const ticTacToeServer = await createTicTacToeServer(3000, {
  persistDatabase: true,
});

const { app, server, socketIOManager, startServer } = ticTacToeServer;

// Serve static files (the HTML client)
app.use(express.static(path.join(__dirname, "../public")));

// Add a simple route to serve the socket.io demo
app.get("/", (_req: express.Request, res: express.Response) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

// Add a health check that includes socket.io info
app.get("/health", (_req: express.Request, res: express.Response) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    game: "Tic-Tac-Toe",
    socketIO: {
      connectedClients: socketIOManager ? "available" : "not available",
    },
  });
});

// Start the server
startServer();

info("Tic-Tac-Toe server with Socket.IO started on port 3000");
info("Visit http://localhost:3000 to play the game");

// Export the app and server for testing purposes
export { app, server, socketIOManager };
