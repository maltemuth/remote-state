/**
 * Example usage of the Remote State Server with Tic-Tac-Toe
 *
 * This file demonstrates how to create and start a tic-tac-toe server
 * using the factory function approach.
 */

import { createTicTacToeServer } from './games/tic-tac-toe/server-config';
import { createLogger } from './logger';

const { info } = createLogger({
  scope: 'example-server',
});

// Create and start the tic-tac-toe server
const { app, startServer } = createTicTacToeServer(3000);

// Start the server
startServer();

info('Tic-Tac-Toe server started on port 3000');

// Export the app for testing purposes
export default app;
