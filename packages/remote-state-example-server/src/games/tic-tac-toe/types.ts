/**
 * Tic-Tac-Toe Game State Types
 */

// Player types
export type Player = "X" | "O";
export type PlayerSymbol = "X" | "O" | null;

// Board representation
export type Board = PlayerSymbol[][];

// Game status
export type GameStatus = "waiting" | "finished";

// Win conditions
export type WinCondition = "row" | "column" | "diagonal" | "draw" | null;
export type WinLine = {
  type: WinCondition;
  player: Player;
  positions: [number, number][]; // Array of [row, col] positions
} | null;

// Game action types
export type TicTacToeActionType = "move" | "restart" | "join" | "leave";

// Game action data
export interface TicTacToeAction {
  type: TicTacToeActionType;
  playerId: string;
  position?: [number, number]; // For move actions
  timestamp: Date;
}

// Game state
export interface TicTacToeState {
  board: Board;
  currentPlayer: Player;
  status: GameStatus;
  winner: Player | null;
  winLine: WinLine;
  players: {
    X: string | null; // Player ID for X
    O: string | null; // Player ID for O
  };
  lastMove: {
    player: Player;
    position: [number, number] | null;
    timestamp: Date | null;
  };
  createdAt: Date;
  updatedAt: Date;
}

// Game validation result
export interface GameValidationResult {
  valid: boolean;
  message: string;
  error?: string;
  code?: string;
}

// Game move result
export interface GameMoveResult {
  success: boolean;
  state: TicTacToeState;
  gameOver: boolean;
  winner: Player | null;
}

// Initial game state
export const createInitialGameState = (_gameId: string): TicTacToeState => ({
  board: [
    [null, null, null],
    [null, null, null],
    [null, null, null],
  ],
  currentPlayer: "X",
  status: "waiting",
  winner: null,
  winLine: null,
  players: {
    X: null,
    O: null,
  },
  lastMove: {
    player: "X",
    position: null,
    timestamp: null,
  },
  createdAt: new Date(),
  updatedAt: new Date(),
});
