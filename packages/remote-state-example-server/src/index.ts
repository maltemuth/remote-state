/**
 * Public entry point of the example package: the example games and servers.
 */

export {
  createBattleshipServer,
  createTicTacToeServer,
} from "./host/servers.js";
export { addLobby } from "./host/lobby.js";
export * as ticTacToe from "./games/tic-tac-toe/index.js";
export {
  battleshipPlugin,
  newBattleshipGame,
} from "./games/battleship/plugin.js";
