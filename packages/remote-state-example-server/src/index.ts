/**
 * Public entry point of the example package: the example games, and the host
 * that serves them.
 */

export { createExampleServer, type ExampleServer } from "./host/servers.js";
export { mountGame } from "./host/mountGame.js";
export { createLobby } from "./host/lobby.js";
export * as ticTacToe from "./games/tic-tac-toe/index.js";
export {
  battleshipPlugin,
  newBattleshipGame,
} from "./games/battleship/plugin.js";
