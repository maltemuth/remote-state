/**
 * Main server file for the Remote State library
 * This file demonstrates how to create and start a server using the library
 */

import { createRemoteStateServer } from './index';
import { TicTacToeState, GameAction, createInitialGameState } from './games/tic-tac-toe/types';
import { validateAction, executeAction } from './games/tic-tac-toe/engine';
import { createLogger } from './logger';

const { info } = createLogger({
  scope: 'main-server',
});

// Create and start the tic-tac-toe server
const { app, startServer } = createRemoteStateServer<TicTacToeState, GameAction>(
  {
    getInitialState: createInitialGameState,
    validateAction,
    executeAction: (
      state: TicTacToeState,
      action: GameAction & { playerId: string; timestamp: Date }
    ) => {
      // The executeAction from the engine expects the action to have playerId and timestamp
      return executeAction(state, action);
    },
    transformState: (state: TicTacToeState) => {
      // Transform the state for better presentation
      return {
        ...state,
        board: state.board.map(row => row.map(cell => (cell === null ? null : cell))),
        status: state.status === 'waiting' ? 'waiting for players' : state.status,
      };
    },
    gameConfig: {
      name: 'Tic-Tac-Toe',
      description: 'Classic 3x3 tic-tac-toe game',
    },
  },
  3000
);

// Start the server
startServer();

info('Tic-Tac-Toe server started on port 3000');

// Export the app for testing purposes
export default app;
