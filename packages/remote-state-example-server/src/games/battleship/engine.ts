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
  CellState,
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
  col: number,
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
    placedShips.includes(shipType as ShipType),
  );
};

/**
 * Check if ship placement is valid
 */
export const isValidShipPlacement = (
  board: Board,
  shipType: ShipType,
  position: [number, number],
  orientation: ShipOrientation,
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
  orientation: ShipOrientation,
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
  position: [number, number],
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

const invalid = (message: string, code: string): GameValidationResult => ({
  valid: false,
  message,
  error: message,
  code,
});

const valid: GameValidationResult = { valid: true, message: "Action is valid" };

const opponentOf = (seat: Player): Player =>
  seat === "player1" ? "player2" : "player1";

/**
 * The seat a player occupies, or null if they have not joined
 */
export const seatOf = (
  state: BattleshipState,
  playerId: string,
): Player | null =>
  state.players.player1 === playerId
    ? "player1"
    : state.players.player2 === playerId
      ? "player2"
      : null;

const isPosition = (position: unknown): position is [number, number] =>
  Array.isArray(position) &&
  position.length === 2 &&
  isValidPosition(position[0], position[1]);

const alreadyTargeted: CellState[] = ["hit", "miss", "sunk"];

/**
 * Validate a game action
 */
export const validateAction = async (
  state: BattleshipState,
  action: BattleshipAction,
  playerId: string,
): Promise<GameValidationResult> => {
  const seat = seatOf(state, playerId);

  switch (action.type) {
    case "join":
      if (seat) {
        return invalid(`Already playing as ${seat}`, "ALREADY_JOINED");
      }
      if (state.players.player1 && state.players.player2) {
        return invalid("Both seats are taken", "GAME_FULL");
      }
      return valid;

    case "leave":
      return seat ? valid : invalid("Not playing in this game", "NOT_JOINED");

    case "restart":
      return seat
        ? valid
        : invalid("Only seated players can restart", "NOT_JOINED");

    case "place_ship": {
      if (state.status === "finished") {
        return invalid("Game is already finished", "GAME_FINISHED");
      }
      if (!seat) {
        return invalid("Join the game first", "NOT_JOINED");
      }
      if (state.status !== "setup") {
        return invalid("Ships can only be placed during setup", "NOT_IN_SETUP");
      }
      const { shipType, position, orientation } = action;
      if (!shipType || !position || !orientation) {
        return invalid(
          "Ship placement requires ship type, position, and orientation",
          "MISSING_PARAMETERS",
        );
      }
      if (!(shipType in SHIP_CONFIGS)) {
        return invalid(`Unknown ship type ${shipType}`, "UNKNOWN_SHIP_TYPE");
      }
      if (orientation !== "horizontal" && orientation !== "vertical") {
        return invalid(
          "Orientation must be horizontal or vertical",
          "INVALID_ORIENTATION",
        );
      }
      if (!isPosition(position)) {
        return invalid(
          "Position must be [row, col] between 0-4",
          "INVALID_POSITION",
        );
      }
      if (state.ships[seat].some((ship) => ship.type === shipType)) {
        return invalid(
          `${SHIP_CONFIGS[shipType].name} already placed`,
          "SHIP_ALREADY_PLACED",
        );
      }
      if (
        !isValidShipPlacement(
          state.boards[seat],
          shipType,
          position,
          orientation,
        )
      ) {
        return invalid("Invalid ship placement", "INVALID_SHIP_PLACEMENT");
      }
      return valid;
    }

    case "fire_shot": {
      if (state.status === "finished") {
        return invalid("Game is already finished", "GAME_FINISHED");
      }
      if (!action.position) {
        return invalid(
          "Position is required for fire shot actions",
          "POSITION_REQUIRED",
        );
      }
      if (state.status !== "playing") {
        return invalid("Game is not in playing state", "GAME_NOT_STARTED");
      }
      if (seat !== state.currentPlayer) {
        return invalid(`It's not ${playerId}'s turn`, "WRONG_PLAYER_TURN");
      }
      if (!isPosition(action.position)) {
        return invalid(
          "Position must be [row, col] between 0-4",
          "INVALID_POSITION",
        );
      }
      const [row, col] = action.position;
      if (alreadyTargeted.includes(state.boards[opponentOf(seat)][row][col])) {
        return invalid(
          "Position already fired at",
          "POSITION_ALREADY_TARGETED",
        );
      }
      return valid;
    }

    default:
      return invalid(
        `Unknown action type ${String(action.type)}`,
        "UNKNOWN_ACTION",
      );
  }
};

/**
 * Execute a validated game action, returning a new state
 */
export const executeAction = async (
  state: BattleshipState,
  action: BattleshipAction,
  playerId: string,
): Promise<GameMoveResult> => {
  const validationResult = await validateAction(state, action, playerId);

  if (!validationResult.valid) {
    return {
      success: false,
      state,
      gameOver: isGameOver(state),
      winner: state.winner,
    };
  }

  let newState: BattleshipState = JSON.parse(JSON.stringify(state));
  const seat = seatOf(state, playerId);
  const timestamp = action.timestamp ?? new Date();

  switch (action.type) {
    case "join":
      newState = addPlayer(
        newState,
        playerId,
        state.players.player1 ? "player2" : "player1",
      );
      break;

    case "leave":
      newState = removePlayer(newState, playerId);
      break;

    case "restart":
      newState = { ...createInitialGameState(""), players: newState.players };
      break;

    case "place_ship": {
      const player = seat as Player;
      const { board, ships } = placeShip(
        newState.boards[player],
        newState.ships[player],
        action.shipType as ShipType,
        action.position as [number, number],
        action.orientation as ShipOrientation,
      );
      newState.boards[player] = board;
      newState.ships[player] = ships;
      newState.lastMove = {
        player,
        action: "place_ship",
        position: action.position as [number, number],
        result: null,
        timestamp,
      };
      newState.updatedAt = timestamp;

      if (
        newState.players.player1 &&
        newState.players.player2 &&
        allShipsPlaced(newState.ships.player1) &&
        allShipsPlaced(newState.ships.player2)
      ) {
        newState.status = "playing";
        newState.currentPlayer = "player1";
      }
      break;
    }

    case "fire_shot": {
      const shooter = newState.currentPlayer;
      const target = opponentOf(shooter);
      const { board, ships, result } = fireShot(
        newState.boards[target],
        newState.ships[target],
        action.position as [number, number],
      );
      newState.boards[target] = board;
      newState.ships[target] = ships;
      newState.lastMove = {
        player: shooter,
        action: "fire_shot",
        position: action.position as [number, number],
        result,
        timestamp,
      };
      newState.updatedAt = timestamp;

      if (ships.length > 0 && ships.every((ship) => ship.sunk)) {
        newState.status = "finished";
        newState.winner = shooter;
      } else {
        newState.currentPlayer = target;
      }
      break;
    }
  }

  return {
    success: true,
    state: newState,
    gameOver: newState.status === "finished",
    winner: newState.winner,
  };
};

/**
 * Seat a player
 */
export const addPlayer = (
  state: BattleshipState,
  playerId: string,
  player: Player,
): BattleshipState => ({
  ...state,
  players: { ...state.players, [player]: playerId },
  updatedAt: new Date(),
});

const hideShips = (board: Board): Board =>
  board.map((row) => row.map((cell) => (cell === "ship" ? "empty" : cell)));

/**
 * Filter game state for a specific player: they see their own board and ships,
 * only shots and sunk ships on the opponent's board, and the opponent's player
 * ID as "opponent". Players without a seat see no ships at all.
 */
export const filterStateForPlayer = (
  state: BattleshipState,
  playerId: string,
): BattleshipState => {
  const seat = seatOf(state, playerId);
  const visible = (player: Player) => player === seat;
  const maskId = (id: string | null) =>
    id === null || id === playerId ? id : "opponent";

  return {
    ...state,
    boards: {
      player1: visible("player1")
        ? state.boards.player1
        : hideShips(state.boards.player1),
      player2: visible("player2")
        ? state.boards.player2
        : hideShips(state.boards.player2),
    },
    ships: {
      player1: visible("player1") ? state.ships.player1 : [],
      player2: visible("player2") ? state.ships.player2 : [],
    },
    players: {
      player1: maskId(state.players.player1),
      player2: maskId(state.players.player2),
    },
  };
};

/**
 * Remove a player from the game, resetting it to setup
 */
export const removePlayer = (
  state: BattleshipState,
  playerId: string,
): BattleshipState => ({
  ...createInitialGameState(""),
  players: {
    player1: state.players.player1 === playerId ? null : state.players.player1,
    player2: state.players.player2 === playerId ? null : state.players.player2,
  },
});
