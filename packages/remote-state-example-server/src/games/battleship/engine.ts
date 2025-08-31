/**
 * Simplified Battleship Game Engine
 * Handles game logic, validation, and state transitions
 */

import {
  BattleshipState,
  BattleshipAction,
  GameValidationResult,
  GameMoveResult,
  Player,
  Board,
  ShipPosition,
  ShipOrientation,
  ShipType,
  createInitialGameState,
  SHIP_CONFIGS,
} from "./types.js";

/**
 * Check if a position is valid on the board
 */
export const isValidPosition = (row: number, col: number): boolean => {
  return row >= 0 && row < 5 && col >= 0 && col < 5;
};

/**
 * Check if a position is empty
 */
export const isPositionEmpty = (
  board: Board,
  row: number,
  col: number
): boolean => {
  if (!isValidPosition(row, col)) return false;
  return board[row][col] === "empty";
};

/**
 * Check if all ships are placed
 */
export const allShipsPlaced = (ships: ShipPosition[]): boolean => {
  const requiredShips = Object.keys(SHIP_CONFIGS);
  const placedShips = ships.map((ship) => ship.type);

  return requiredShips.every((shipType) =>
    placedShips.includes(shipType as ShipType)
  );
};

/**
 * Check if ship placement is valid
 */
export const isValidShipPlacement = (
  board: Board,
  shipType: ShipType,
  position: [number, number],
  orientation: ShipOrientation
): boolean => {
  const shipSize = SHIP_CONFIGS[shipType].size;
  const [startRow, startCol] = position;

  // Check if ship fits on board
  if (orientation === "horizontal") {
    if (startCol + shipSize > 5) return false;
    for (let i = 0; i < shipSize; i++) {
      if (!isPositionEmpty(board, startRow, startCol + i)) return false;
    }
  } else {
    if (startRow + shipSize > 5) return false;
    for (let i = 0; i < shipSize; i++) {
      if (!isPositionEmpty(board, startRow + i, startCol)) return false;
    }
  }

  return true;
};

/**
 * Place a ship on the board
 */
export const placeShip = (
  board: Board,
  ships: ShipPosition[],
  shipType: ShipType,
  position: [number, number],
  orientation: ShipOrientation
): { board: Board; ships: ShipPosition[] } => {
  const newBoard = board.map((row) => [...row]);
  const newShips = [...ships];
  const shipSize = SHIP_CONFIGS[shipType].size;
  const [startRow, startCol] = position;

  const shipPositions: [number, number][] = [];

  // Place ship on board
  if (orientation === "horizontal") {
    for (let i = 0; i < shipSize; i++) {
      newBoard[startRow][startCol + i] = "ship";
      shipPositions.push([startRow, startCol + i]);
    }
  } else {
    for (let i = 0; i < shipSize; i++) {
      newBoard[startRow + i][startCol] = "ship";
      shipPositions.push([startRow + i, startCol]);
    }
  }

  // Add ship to ships array
  newShips.push({
    type: shipType,
    positions: shipPositions,
    orientation,
    hits: 0,
    sunk: false,
  });

  return { board: newBoard, ships: newShips };
};

/**
 * Check if a ship is sunk
 */
export const isShipSunk = (ship: ShipPosition): boolean => {
  return ship.hits === SHIP_CONFIGS[ship.type].size;
};

/**
 * Fire a shot and update the board
 */
export const fireShot = (
  board: Board,
  ships: ShipPosition[],
  position: [number, number]
): { board: Board; ships: ShipPosition[]; result: "hit" | "miss" | "sunk" } => {
  const [row, col] = position;
  const newBoard = board.map((row) => [...row]);
  const newShips = ships.map((ship) => ({ ...ship }));
  let result: "hit" | "miss" | "sunk" = "miss";

  if (newBoard[row][col] === "ship") {
    newBoard[row][col] = "hit";
    result = "hit";

    // Find and update the hit ship
    for (let i = 0; i < newShips.length; i++) {
      const ship = newShips[i];
      if (ship.positions.some(([r, c]) => r === row && c === col)) {
        ship.hits++;
        if (isShipSunk(ship)) {
          ship.sunk = true;
          result = "sunk";
          // Mark all ship positions as sunk
          ship.positions.forEach(([r, c]) => {
            newBoard[r][c] = "sunk";
          });
        }
        break;
      }
    }
  } else if (newBoard[row][col] === "empty") {
    newBoard[row][col] = "miss";
  }

  return { board: newBoard, ships: newShips, result };
};

/**
 * Check if game is over
 */
export const isGameOver = (state: BattleshipState): boolean => {
  if (state.status !== "playing") return false;

  // Check if all ships of a player are sunk
  const player1AllSunk = state.ships.player1.every((ship) => ship.sunk);
  const player2AllSunk = state.ships.player2.every((ship) => ship.sunk);

  return player1AllSunk || player2AllSunk;
};

/**
 * Validate a game action
 */
export const validateAction = (
  state: BattleshipState,
  action: BattleshipAction
): GameValidationResult => {
  // Check if game is over
  if (state.status === "finished") {
    return {
      valid: false,
      message: "Game is already finished",
      error: "Game is already finished",
      code: "GAME_FINISHED",
    };
  }

  // For ship placement actions
  if (action.type === "place_ship") {
    if (!action.shipType || !action.position || !action.orientation) {
      return {
        valid: false,
        message: "Ship placement requires ship type, position, and orientation",
        error: "Missing required parameters",
        code: "MISSING_PARAMETERS",
      };
    }

    const [row, col] = action.position;

    // Check if it's the correct player's turn during setup
    if (state.status === "setup") {
      const currentPlayerShips =
        state.ships[
          action.playerId === state.players.player1 ? "player1" : "player2"
        ];
      if (allShipsPlaced(currentPlayerShips)) {
        return {
          valid: false,
          message: "All ships already placed",
          error: "All ships already placed",
          code: "ALL_SHIPS_PLACED",
        };
      }
    }

    // Check if position is valid
    if (!isValidPosition(row, col)) {
      return {
        valid: false,
        message: "Invalid position",
        error: "Position must be between 0-4",
        code: "INVALID_POSITION",
      };
    }

    // Check if ship placement is valid
    const playerKey =
      action.playerId === state.players.player1 ? "player1" : "player2";
    if (
      !isValidShipPlacement(
        state.boards[playerKey],
        action.shipType,
        action.position,
        action.orientation
      )
    ) {
      return {
        valid: false,
        message: "Invalid ship placement",
        error: "Ship placement is invalid",
        code: "INVALID_SHIP_PLACEMENT",
      };
    }
  }

  // For fire shot actions
  if (action.type === "fire_shot") {
    if (!action.position) {
      return {
        valid: false,
        message: "Position is required for fire shot actions",
        error: "Position is required",
        code: "POSITION_REQUIRED",
      };
    }

    const [row, col] = action.position;

    // Check if it's the correct player's turn
    if (action.playerId !== state.players[state.currentPlayer]) {
      return {
        valid: false,
        message: `It's not ${action.playerId}'s turn`,
        error: "Wrong player turn",
        code: "WRONG_PLAYER_TURN",
      };
    }

    // Check if game is in playing state
    if (state.status !== "playing") {
      return {
        valid: false,
        message: "Game is not in playing state",
        error: "Game not started",
        code: "GAME_NOT_STARTED",
      };
    }

    // Check if position is valid
    if (!isValidPosition(row, col)) {
      return {
        valid: false,
        message: "Invalid position",
        error: "Position must be between 0-4",
        code: "INVALID_POSITION",
      };
    }

    // Check if position has already been fired at
    const opponentKey =
      state.currentPlayer === "player1" ? "player2" : "player1";
    if (state.boards[opponentKey][row][col] !== "empty") {
      return {
        valid: false,
        message: "Position already fired at",
        error: "Position already targeted",
        code: "POSITION_ALREADY_TARGETED",
      };
    }
  }

  return {
    valid: true,
    message: "Action is valid",
  };
};

/**
 * Execute a game action
 */
export const executeAction = (
  state: BattleshipState,
  action: BattleshipAction
): GameMoveResult => {
  const validationResult = validateAction(state, action);

  if (!validationResult.valid) {
    return {
      success: false,
      state,
      gameOver: isGameOver(state),
      winner: state.winner,
    };
  }

  let newState = { ...state };
  let winner: Player | null = null;
  let gameOver = false;

  // Handle different action types
  switch (action.type) {
    case "place_ship":
      if (action.shipType && action.position && action.orientation) {
        const playerKey =
          action.playerId === state.players.player1 ? "player1" : "player2";
        const { board, ships } = placeShip(
          newState.boards[playerKey],
          newState.ships[playerKey],
          action.shipType,
          action.position,
          action.orientation
        );

        newState.boards[playerKey] = board;
        newState.ships[playerKey] = ships;
        newState.lastMove = {
          player: playerKey as Player,
          action: "place_ship",
          position: action.position,
          result: null,
          timestamp: action.timestamp,
        };
        newState.updatedAt = action.timestamp;

        // Check if both players have placed all ships
        if (
          allShipsPlaced(newState.ships.player1) &&
          allShipsPlaced(newState.ships.player2)
        ) {
          newState.status = "playing";
        }
      }
      break;

    case "fire_shot":
      if (action.position) {
        const opponentKey =
          newState.currentPlayer === "player1" ? "player2" : "player1";
        const { board, ships, result } = fireShot(
          newState.boards[opponentKey],
          newState.ships[opponentKey],
          action.position
        );

        newState.boards[opponentKey] = board;
        newState.ships[opponentKey] = ships;
        newState.lastMove = {
          player: newState.currentPlayer,
          action: "fire_shot",
          position: action.position,
          result,
          timestamp: action.timestamp,
        };
        newState.updatedAt = action.timestamp;

        // Check for game over
        if (isGameOver(newState)) {
          newState.status = "finished";
          gameOver = true;
          // Determine winner
          const player1AllSunk = newState.ships.player1.every(
            (ship) => ship.sunk
          );
          winner = player1AllSunk ? "player2" : "player1";
          newState.winner = winner;
        } else {
          // Switch players
          newState.currentPlayer =
            newState.currentPlayer === "player1" ? "player2" : "player1";
        }
      }
      break;

    case "restart":
      // Reset the game but keep players
      newState = createInitialGameState("");
      newState.players = state.players;
      break;

    case "join":
      // Handle player joining (already handled in service layer)
      break;

    case "leave":
      // Handle player leaving (already handled in service layer)
      break;
  }

  return {
    success: true,
    state: newState,
    gameOver,
    winner,
  };
};

/**
 * Add a player to the game
 */
export const addPlayer = (
  state: BattleshipState,
  playerId: string,
  player: Player
): BattleshipState => {
  const newState = { ...state };
  newState.players[player] = playerId;
  newState.updatedAt = new Date();

  return newState;
};

/**
 * Filter game state for a specific player
 * This ensures players only see information they should have access to
 */
export const filterStateForPlayer = (
  state: BattleshipState,
  playerId: string
): BattleshipState => {
  // Create a deep copy of the state to avoid mutating the original
  const filteredState: BattleshipState = JSON.parse(JSON.stringify(state));

  // Determine which player this is
  let currentPlayer: Player = "player1";
  if (playerId === filteredState.players.player2) {
    currentPlayer = "player2";
  }

  // Hide opponent's ships and show only hit/miss information
  const opponentKey = currentPlayer === "player1" ? "player2" : "player1";

  // Create opponent board with only hit/miss information (ships are hidden)
  const opponentBoard = filteredState.boards[opponentKey].map((row) =>
    row.map((cell) => {
      if (cell === "ship") {
        return "empty"; // Hide opponent's ships
      }
      return cell; // Show hit/miss/sunk information
    })
  );

  // Update boards - player sees their own ships and opponent's hit/miss information
  filteredState.boards = {
    player1:
      currentPlayer === "player1"
        ? filteredState.boards.player1
        : opponentBoard,
    player2:
      currentPlayer === "player2"
        ? filteredState.boards.player2
        : opponentBoard,
  };

  // Hide opponent's ship details
  filteredState.ships = {
    player1: currentPlayer === "player1" ? filteredState.ships.player1 : [],
    player2: currentPlayer === "player2" ? filteredState.ships.player2 : [],
  };

  return filteredState;
};

/**
 * Remove a player from the game
 */
export const removePlayer = (
  state: BattleshipState,
  playerId: string
): BattleshipState => {
  const newState = { ...state };

  // Remove player from their position
  if (newState.players.player1 === playerId) {
    newState.players.player1 = null;
  } else if (newState.players.player2 === playerId) {
    newState.players.player2 = null;
  }

  // Reset game if a player leaves
  newState.winner = null;
  newState.currentPlayer = "player1";
  newState.status = "setup";
  newState.updatedAt = new Date();

  return newState;
};
