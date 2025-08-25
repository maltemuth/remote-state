import { createTicTacToeServer } from './games/tic-tac-toe/server-config';

// Create tic-tac-toe server using the factory function
const { app, startServer } = createTicTacToeServer(3000);

// Start the server
startServer();

export default app;
