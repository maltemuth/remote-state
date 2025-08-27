/**
 * Example usage of the Remote State Server with Tic-Tac-Toe
 *
 * This file demonstrates how to create and start a tic-tac-toe server
 * using the factory function approach.
 */

import { createTicTacToeServer } from "./server-config.js";
import { createLogger } from "@malte.muth/remote-state";

const { info } = createLogger({
  scope: "example-server",
});

// Create and start the tic-tac-toe server with persistent database
const { app, startServer } = createTicTacToeServer(3000, {
  persistDatabase: true,
});

// Start the server
startServer();

info("Tic-Tac-Toe server started on port 3000");

// Export the app for testing purposes
export default app;
