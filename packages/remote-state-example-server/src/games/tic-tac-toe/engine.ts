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
} from "./types";

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
  col: number
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

/**
 * Validate a game action
 */
export const validateAction = async (
  state: TicTacToeState,
  action: TicTacToeAction,
  playerId: string
): Promise<GameValidationResult> => {
  // Check if game is over
  if (isGameOver(state)) {
    return {
      valid: false,
      message: "Game is already finished",
      error: "Game is already finished",
      code: "GAME_FINISHED",
    };
  }

  // For move actions
  if (action.type === "move" && action.position) {
    const [row, col] = action.position;

    // Check if it's the correct player's turn
    if (playerId !== state.players[state.currentPlayer]) {
      return {
        valid: false,
        message: `It's not ${playerId}'s turn`,
        error: "Wrong player turn",
        code: "WRONG_PLAYER_TURN",
      };
    }

    // Check if position is valid
    if (!isValidPosition(row, col)) {
      return {
        valid: false,
        message: "Invalid position",
        error: "Position must be between 0-2",
        code: "INVALID_POSITION",
      };
    }

    // Check if position is empty
    if (!isPositionEmpty(state.board, row, col)) {
      return {
        valid: false,
        message: "Position is already occupied",
        error: "Position already taken",
        code: "POSITION_OCCUPIED",
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
export const executeAction = async (
  state: TicTacToeState,
  action: TicTacToeAction,
  playerId: string
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

  let newState = { ...state };
  let winner: Player | null = null;
  let gameOver = false;

  // Handle different action types
  switch (action.type) {
    case "move":
      if (action.position) {
        const [row, col] = action.position;

        // Make the move
        newState.board[row][col] = state.currentPlayer;
        newState.lastMove = {
          player: state.currentPlayer,
          position: [row, col],
          timestamp: action.timestamp,
        };
        newState.updatedAt = action.timestamp;

        // Check for win
        const winLine = checkWin(newState.board, state.currentPlayer);
        if (winLine) {
          newState.winner = state.currentPlayer;
          newState.winLine = winLine;
          newState.status = "finished";
          winner = state.currentPlayer;
          gameOver = true;
        } else if (isBoardFull(newState.board)) {
          // Draw
          newState.status = "finished";
          gameOver = true;
        } else {
          // Switch players
          newState.currentPlayer = state.currentPlayer === "X" ? "O" : "X";
        }
      }
      break;

    case "restart":
      // Reset the game but keep players
      newState = createInitialGameState();
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
 * Start the game (when both players have joined)
 */
export const startGame = (state: TicTacToeState): TicTacToeState => {
  if (state.players.X && state.players.O) {
    return {
      ...state,
      updatedAt: new Date(),
    };
  }
  return state;
};

/**
 * Add a player to the game
 */
export const addPlayer = (
  state: TicTacToeState,
  playerId: string,
  playerSymbol: Player
): TicTacToeState => {
  const newState = { ...state };
  newState.players[playerSymbol] = playerId;
  newState.updatedAt = new Date();

  return newState;
};

/**
 * Filter game state for a specific player
 * This ensures players only see information they should have access to
 */
export const filterStateForPlayer = (
  state: TicTacToeState,
  playerId: string
): TicTacToeState => {
  // Create a deep copy of the state to avoid mutating the original
  const filteredState: TicTacToeState = JSON.parse(JSON.stringify(state));

  // Hide opponent's identity if they haven't revealed it
  // In Tic-Tac-Toe, we'll show which symbol each player controls
  // but hide the actual player IDs for privacy
  const playerSymbols: { [key: string]: Player | null } = {};

  // Map player IDs to their symbols for the current player
  if (filteredState.players.X === playerId) {
    playerSymbols[playerId] = "X";
    // Show opponent as "Player O" without revealing their actual ID
    playerSymbols[filteredState.players.O || "unknown"] = "O";
  } else if (filteredState.players.O === playerId) {
    playerSymbols[playerId] = "O";
    // Show opponent as "Player X" without revealing their actual ID
    playerSymbols[filteredState.players.X || "unknown"] = "X";
  } else {
    // If player is not in this game, show minimal information
    return {
      ...filteredState,
      players: { X: null, O: null },
      board: Array(3)
        .fill(null)
        .map(() => Array(3).fill(null)),
      currentPlayer: "X",
      status: "waiting",
      winner: null,
      winLine: null,
      lastMove: { player: "X", position: null, timestamp: null },
    };
  }

  // Update the state with filtered player information
  filteredState.players = {
    X: playerSymbols[playerId] === "X" ? playerId : "Player O",
    O: playerSymbols[playerId] === "O" ? playerId : "Player X",
  };

  return filteredState;
};

/**
 * Remove a player from the game
 */
export const removePlayer = (
  state: TicTacToeState,
  playerId: string
): TicTacToeState => {
  const newState = { ...state };

  // Remove player from their symbol
  if (newState.players.X === playerId) {
    newState.players.X = null;
  } else if (newState.players.O === playerId) {
    newState.players.O = null;
  }

  // Reset game if a player leaves
  newState.winner = null;
  newState.winLine = null;
  newState.currentPlayer = "X";
  newState.updatedAt = new Date();

  return newState;
};

/**
 * Simple validation function for testing purposes
 * Returns true | string to match ActionValidationResult type
 */
export const validateActionSimple = async (
  state: TicTacToeState,
  action: {
    type: "move";
    position: [number, number];
    playerId: string;
    timestamp: Date;
  },
  _playerId: string
): Promise<true | string> => {
  // Check if game is finished
  if (state.winner !== null) {
    return "Game is already finished";
  }

  // Simple validation for tic-tac-toe moves
  if (action.type === "move") {
    const [row, col] = action.position;

    // Check if position is valid
    if (row < 0 || row > 2 || col < 0 || col > 2) {
      return "Position out of bounds";
    }

    // Check if position is empty
    if (state.board[row][col] !== null) {
      return "Position already occupied";
    }
  }

  return true;
};

/**
 * Simple execution function for testing purposes
 */
export const executeActionSimple = async (
  state: TicTacToeState,
  action: {
    type: "move";
    position: [number, number];
    playerId: string;
    timestamp: Date;
  },
  _playerId: string
): Promise<TicTacToeState> => {
  // Simple execution for tic-tac-toe moves
  const newState = JSON.parse(JSON.stringify(state)); // Deep copy

  if (action.type === "move") {
    const [row, col] = action.position;
    newState.board[row][col] = state.currentPlayer;
    newState.lastMove = {
      player: state.currentPlayer,
      position: [row, col],
      timestamp: action.timestamp,
    };

    // Check for win
    const player = state.currentPlayer;
    let winner = null;
    let winLine = null;

    // Check rows
    for (let r = 0; r < 3; r++) {
      if (
        newState.board[r][0] === player &&
        newState.board[r][1] === player &&
        newState.board[r][2] === player
      ) {
        winner = player;
        winLine = {
          type: "row",
          player,
          positions: [
            [r, 0],
            [r, 1],
            [r, 2],
          ],
        };
        break;
      }
    }

    // Check columns
    if (!winner) {
      for (let c = 0; c < 3; c++) {
        if (
          newState.board[0][c] === player &&
          newState.board[1][c] === player &&
          newState.board[2][c] === player
        ) {
          winner = player;
          winLine = {
            type: "column",
            player,
            positions: [
              [0, c],
              [1, c],
              [2, c],
            ],
          };
          break;
        }
      }
    }

    // Check diagonals
    if (!winner) {
      if (
        newState.board[0][0] === player &&
        newState.board[1][1] === player &&
        newState.board[2][2] === player
      ) {
        winner = player;
        winLine = {
          type: "diagonal",
          player,
          positions: [
            [0, 0],
            [1, 1],
            [2, 2],
          ],
        };
      } else if (
        newState.board[0][2] === player &&
        newState.board[1][1] === player &&
        newState.board[2][0] === player
      ) {
        winner = player;
        winLine = {
          type: "diagonal",
          player,
          positions: [
            [0, 2],
            [1, 1],
            [2, 0],
          ],
        };
      }
    }

    if (winner) {
      newState.winner = winner;
      newState.winLine = winLine;
    } else {
      // Switch players
      newState.currentPlayer = state.currentPlayer === "X" ? "O" : "X";
    }
  }

  return newState;
};
