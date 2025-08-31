import {
  createRemoteStateServer,
  type RemoteStateServer,
} from "@malte.muth/remote-state";
import {
  TicTacToeState,
  TicTacToeAction,
  createInitialGameState,
} from "./games/tic-tac-toe/types.js";
import { validateAction, executeAction } from "./games/tic-tac-toe/engine.js";

export const createTicTacToeServer = (
  port: number = 3000,
  options: { persistDatabase?: boolean } = { persistDatabase: false }
): Promise<
  RemoteStateServer<TicTacToeState, TicTacToeAction, TicTacToeState>
> => {
  return createRemoteStateServer<
    TicTacToeState,
    TicTacToeAction,
    TicTacToeState
  >(
    {
      getInitialState: () => Promise.resolve(createInitialGameState()),
      validateAction: (state, action, playerId) => {
        return validateAction(state, action, playerId).then((result) => {
          return result.valid ? true : result.message;
        });
      },
      executeAction: (state, action, playerId) => {
        return executeAction(state, action, playerId).then((result) => {
          return result.state;
        });
      },
      filterStateForPlayer: (state, playerId) => {
        // Import the filter function here to avoid circular dependencies
        return import("./games/tic-tac-toe/engine.js").then((engine) => {
          return engine.filterStateForPlayer(state, playerId);
        });
      },
      gameConfig: {
        name: "Tic-Tac-Toe",
        description: "Classic 3x3 tic-tac-toe game",
      },
      serverConfiguration: {
        persistDatabase: options.persistDatabase,
      },
    },
    port
  );
};
