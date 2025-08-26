import {
  createRemoteStateServer,
  type RemoteStateServer,
} from "@malte.muth/remote-state";
import {
  TicTacToeState,
  GameAction,
  createInitialGameState,
} from "./games/tic-tac-toe/types";
import { validateAction, executeAction } from "./games/tic-tac-toe/engine";

export const createTicTacToeServer = (
  port: number = 3000
): RemoteStateServer => {
  return createRemoteStateServer<TicTacToeState, GameAction>(
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
          board: state.board.map((row: (string | null)[]) =>
            row.map((cell: string | null) => (cell === null ? null : cell))
          ),
          status:
            state.status === "waiting" ? "waiting for players" : state.status,
        };
      },
      gameConfig: {
        name: "Tic-Tac-Toe",
        description: "Classic 3x3 tic-tac-toe game",
      },
    },
    port
  );
};
