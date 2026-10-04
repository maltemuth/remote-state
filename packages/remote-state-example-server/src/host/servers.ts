/**
 * Remote State servers for the example games, each with the example's lobby
 * endpoints attached.
 */

import {
  createRemoteStateServer,
  type RemoteStateServer,
} from "@malte.muth/remote-state";
import {
  battleshipPlugin,
  newBattleshipGame,
} from "../games/battleship/plugin.js";
import type { BattleshipState } from "../games/battleship/types.js";
import { newTicTacToeGame } from "../games/tic-tac-toe/rules.js";
import { ticTacToePlugin } from "../games/tic-tac-toe/plugin.js";
import type { TicTacToeState } from "../games/tic-tac-toe/types.js";
import { addLobby } from "./lobby.js";

export interface ServerOptions {
  persistDatabase?: boolean;
}

export const createTicTacToeServer = async (
  port: number = 3000,
  { persistDatabase = false }: ServerOptions = {},
): Promise<RemoteStateServer<TicTacToeState>> => {
  const server = await createRemoteStateServer(
    { ...ticTacToePlugin, serverConfiguration: { persistDatabase } },
    port,
  );
  addLobby(server, newTicTacToeGame);
  return server;
};

export const createBattleshipServer = async (
  port: number = 3000,
  { persistDatabase = false }: ServerOptions = {},
): Promise<RemoteStateServer<BattleshipState>> => {
  const server = await createRemoteStateServer(
    { ...battleshipPlugin, serverConfiguration: { persistDatabase } },
    port,
  );
  addLobby(server, newBattleshipGame);
  return server;
};
