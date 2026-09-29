import {
  createRemoteStateServer,
  type RemoteStateServer,
} from "@malte.muth/remote-state";
import { TicTacToeState, TicTacToeAction } from "./games/tic-tac-toe/types.js";
import { ticTacToePlugin } from "./games/tic-tac-toe/plugin.js";

export const createTicTacToeServer = (
  port: number = 3000,
  options: { persistDatabase?: boolean } = { persistDatabase: false },
): Promise<
  RemoteStateServer<TicTacToeState, TicTacToeAction, TicTacToeState>
> =>
  createRemoteStateServer(
    {
      ...ticTacToePlugin,
      serverConfiguration: {
        persistDatabase: options.persistDatabase,
      },
    },
    port,
  );
