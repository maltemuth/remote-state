/**
 * Tic-Tac-Toe Game Engine
 * Handles game logic, validation, and state transitions
 */

import {
  TicTacToeState,
  TicTacToeAction,
  GameValidationResult,
  GameMoveResult,
  Player,
  Board,
  WinLine,
  createInitialGameState,
} from "./types.js";

/**
 * Check if a position is valid on the board
 */
export const isValidPosition = (row: number, col: number): boolean => {
  return row >= 0 && row < 3 && col >= 0 && col < 3;
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
  return board[row][col] === null;
};

/**
 * Check if the board is full
 */
export const isBoardFull = (board: Board): boolean => {
  return board.every((row) => row.every((cell) => cell !== null));
};

/**
 * Check for win conditions
 */
export const checkWin = (board: Board, player: Player): WinLine => {
  // Check rows
  for (let row = 0; row < 3; row++) {
    if (
      board[row][0] === player &&
      board[row][1] === player &&
      board[row][2] === player
    ) {
      return {
        type: "row",
        player,
        positions: [
          [row, 0],
          [row, 1],
          [row, 2],
        ],
      };
    }
  }

  // Check columns
  for (let col = 0; col < 3; col++) {
    if (
      board[0][col] === player &&
      board[1][col] === player &&
      board[2][col] === player
    ) {
      return {
        type: "column",
        player,
        positions: [
          [0, col],
          [1, col],
          [2, col],
        ],
      };
    }
  }

  // Check diagonals
  if (
    board[0][0] === player &&
    board[1][1] === player &&
    board[2][2] === player
  ) {
    return {
      type: "diagonal",
      player,
      positions: [
        [0, 0],
        [1, 1],
        [2, 2],
      ],
    };
  }

  if (
    board[0][2] === player &&
    board[1][1] === player &&
    board[2][0] === player
  ) {
    return {
      type: "diagonal",
      player,
      positions: [
        [0, 2],
        [1, 1],
        [2, 0],
      ],
    };
  }

  return null;
};

/**
 * Check if game is over
 */
export const isGameOver = (state: TicTacToeState): boolean => {
  return (
    state.status === "finished" ||
    state.winner !== null ||
    isBoardFull(state.board)
  );
};

const invalid = (message: string, code: string): GameValidationResult => ({
  valid: false,
  message,
  error: message,
  code,
});

/**
 * The symbol a player is seated as, or null if they have not joined
 */
export const seatOf = (
  state: TicTacToeState,
  playerId: string,
): Player | null =>
  state.players.X === playerId
    ? "X"
    : state.players.O === playerId
      ? "O"
      : null;

/**
 * Validate a game action
 */
export const validateAction = async (
  state: TicTacToeState,
  action: TicTacToeAction,
  playerId: string,
): Promise<GameValidationResult> => {
  const seat = seatOf(state, playerId);

  switch (action.type) {
    case "join":
      if (seat) {
        return invalid(`Already playing as ${seat}`, "ALREADY_JOINED");
      }
      if (state.players.X && state.players.O) {
        return invalid("Both seats are taken", "GAME_FULL");
      }
      return { valid: true, message: "Action is valid" };

    case "leave":
      if (!seat) {
        return invalid("Not playing in this game", "NOT_JOINED");
      }
      return { valid: true, message: "Action is valid" };

    case "restart":
      if (!seat) {
        return invalid("Only seated players can restart", "NOT_JOINED");
      }
      return { valid: true, message: "Action is valid" };

    case "move": {
      if (isGameOver(state)) {
        return invalid("Game is already finished", "GAME_FINISHED");
      }
      if (state.status !== "playing") {
        return invalid("Waiting for a second player", "WAITING_FOR_PLAYERS");
      }
      if (!seat || seat !== state.currentPlayer) {
        return invalid(
          `It's ${state.currentPlayer}'s turn`,
          "WRONG_PLAYER_TURN",
        );
      }
      const position = action.position;
      if (
        !Array.isArray(position) ||
        position.length !== 2 ||
        !isValidPosition(position[0], position[1])
      ) {
        return invalid(
          "Position must be [row, col] between 0-2",
          "INVALID_POSITION",
        );
      }
      if (!isPositionEmpty(state.board, position[0], position[1])) {
        return invalid("Position is already occupied", "POSITION_OCCUPIED");
      }
      return { valid: true, message: "Action is valid" };
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
  state: TicTacToeState,
  action: TicTacToeAction,
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

  let newState: TicTacToeState = JSON.parse(JSON.stringify(state));

  switch (action.type) {
    case "join":
      newState = addPlayer(newState, playerId, state.players.X ? "O" : "X");
      break;

    case "leave":
      newState = removePlayer(newState, playerId);
      break;

    case "restart":
      newState = { ...createInitialGameState(), players: newState.players };
      newState.status =
        newState.players.X && newState.players.O ? "playing" : "waiting";
      break;

    case "move": {
      const [row, col] = action.position as [number, number];
      const player = state.currentPlayer;
      const timestamp = action.timestamp ?? new Date();

      newState.board[row][col] = player;
      newState.lastMove = { player, position: [row, col], timestamp };
      newState.updatedAt = timestamp;

      const winLine = checkWin(newState.board, player);
      if (winLine) {
        newState.winner = player;
        newState.winLine = winLine;
        newState.status = "finished";
      } else if (isBoardFull(newState.board)) {
        newState.status = "finished";
      } else {
        newState.currentPlayer = player === "X" ? "O" : "X";
      }
      break;
    }
  }

  return {
    success: true,
    state: newState,
    gameOver: isGameOver(newState),
    winner: newState.winner,
  };
};

/**
 * Seat a player; the game starts once both seats are taken
 */
export const addPlayer = (
  state: TicTacToeState,
  playerId: string,
  playerSymbol: Player,
): TicTacToeState => {
  const players = { ...state.players, [playerSymbol]: playerId };
  return {
    ...state,
    players,
    status: players.X && players.O ? "playing" : state.status,
    updatedAt: new Date(),
  };
};

/**
 * Filter game state for a specific player: the opponent's player ID is replaced
 * with "opponent". Tic-tac-toe has no other hidden information.
 */
export const filterStateForPlayer = (
  state: TicTacToeState,
  playerId: string,
): TicTacToeState => {
  const mask = (seatedId: string | null) =>
    seatedId === null || seatedId === playerId ? seatedId : "opponent";
  return {
    ...state,
    players: { X: mask(state.players.X), O: mask(state.players.O) },
  };
};

/**
 * Remove a player from the game, resetting the board
 */
export const removePlayer = (
  state: TicTacToeState,
  playerId: string,
): TicTacToeState => {
  const players = {
    X: state.players.X === playerId ? null : state.players.X,
    O: state.players.O === playerId ? null : state.players.O,
  };
  return { ...createInitialGameState(), players };
};
