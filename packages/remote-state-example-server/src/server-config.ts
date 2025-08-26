import {
  createRemoteStateServer,
  type RemoteStateServer,
} from "@malte.muth/remote-state";
import {
  TicTacToeState,
  TicTacToeAction,
  createInitialGameState,
} from "./games/tic-tac-toe/types";
import { validateAction, executeAction } from "./games/tic-tac-toe/engine";

export const createTicTacToeServer = (
  port: number = 3000
): RemoteStateServer => {
  return createRemoteStateServer<TicTacToeState, TicTacToeAction>(
    {
      getInitialState: createInitialGameState,
      validateAction,
      executeAction,
      gameConfig: {
        name: "Tic-Tac-Toe",
        description: "Classic 3x3 tic-tac-toe game",
      },
    },
    port
  );
};
