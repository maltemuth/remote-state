/**
 * Simplified Battleship Game State Types
 */

// Player types
export type Player = "player1" | "player2";

// Ship types
export type ShipType = "destroyer" | "battleship";
export type ShipOrientation = "horizontal" | "vertical";

// Board representation (5x5 grid)
export type CellState = "empty" | "ship" | "hit" | "miss" | "sunk";
export type Board = CellState[][];

// Ship positions
export interface ShipPosition {
  type: ShipType;
  positions: [number, number][]; // Array of [row, col] positions
  orientation: ShipOrientation;
  hits: number;
  sunk: boolean;
}

// Game status
export type GameStatus = "setup" | "playing" | "finished";

// Game action types
export type BattleshipActionType =
  | "place_ship"
  | "fire_shot"
  | "restart"
  | "join"
  | "leave";

// Game action data. Clients send `type` and the action's fields; the server
// adds `playerId` and `timestamp` before executing it.
export interface BattleshipAction {
  type: BattleshipActionType;
  shipType?: ShipType; // For place_ship actions
  position?: [number, number]; // For place_ship and fire_shot actions
  orientation?: ShipOrientation; // For place_ship actions
  playerId?: string;
  timestamp?: Date;
}

// Game state
export interface BattleshipState {
  boards: {
    player1: Board;
    player2: Board;
  };
  ships: {
    player1: ShipPosition[];
    player2: ShipPosition[];
  };
  currentPlayer: Player;
  status: GameStatus;
  winner: Player | null;
  players: {
    player1: string | null; // Player ID for player1
    player2: string | null; // Player ID for player2
  };
  lastMove: {
    player: Player;
    action: BattleshipActionType;
    position: [number, number] | null;
    result: "hit" | "miss" | "sunk" | null;
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
  state: BattleshipState;
  gameOver: boolean;
  winner: Player | null;
}

// Ship configurations
export const SHIP_CONFIGS: Record<ShipType, { size: number; name: string }> = {
  destroyer: { size: 3, name: "Destroyer" }, // 1x3 ship
  battleship: { size: 4, name: "Battleship" }, // 1x4 ship
};

// Initial game state
export const createInitialGameState = (_gameId: string): BattleshipState => ({
  boards: {
    player1: Array(5)
      .fill(null)
      .map(() => Array(5).fill("empty")),
    player2: Array(5)
      .fill(null)
      .map(() => Array(5).fill("empty")),
  },
  ships: {
    player1: [],
    player2: [],
  },
  currentPlayer: "player1",
  status: "setup",
  winner: null,
  players: {
    player1: null,
    player2: null,
  },
  lastMove: {
    player: "player1",
    action: "join",
    position: null,
    result: null,
    timestamp: null,
  },
  createdAt: new Date(),
  updatedAt: new Date(),
});
