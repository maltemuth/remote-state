/**
 * Battleship Game Engine Tests
 */

import {
  createInitialGameState,
  Player,
  ShipType,
  ShipOrientation,
} from "../../../src/games/battleship/types.js";
import {
  isValidPosition,
  isPositionEmpty,
  allShipsPlaced,
  isValidShipPlacement,
  placeShip,
  isShipSunk,
  fireShot,
  isGameOver,
  validateAction,
  executeAction,
  addPlayer,
  filterStateForPlayer,
  removePlayer,
  seatOf,
} from "../../../src/games/battleship/engine.js";

// Import Jest globals
import { describe, beforeEach, test, expect } from "@jest/globals";

describe("Battleship Game Engine", () => {
  let gameState: ReturnType<typeof createInitialGameState>;

  beforeEach(() => {
    gameState = createInitialGameState("test-game");
  });

  describe("Position Validation", () => {
    test("should validate correct positions", () => {
      expect(isValidPosition(0, 0)).toBe(true);
      expect(isValidPosition(4, 4)).toBe(true);
      expect(isValidPosition(2, 3)).toBe(true);
    });

    test("should reject invalid positions", () => {
      expect(isValidPosition(-1, 0)).toBe(false);
      expect(isValidPosition(5, 0)).toBe(false);
      expect(isValidPosition(0, -1)).toBe(false);
      expect(isValidPosition(0, 5)).toBe(false);
    });
  });

  describe("Position Empty Check", () => {
    test("should detect empty positions", () => {
      expect(isPositionEmpty(gameState.boards.player1, 0, 0)).toBe(true);
      expect(isPositionEmpty(gameState.boards.player1, 2, 3)).toBe(true);
    });

    test("should detect non-empty positions", () => {
      const board = gameState.boards.player1.map((row) => [...row]);
      board[0][0] = "ship";
      expect(isPositionEmpty(board, 0, 0)).toBe(false);
    });

    test("should reject invalid positions", () => {
      expect(isPositionEmpty(gameState.boards.player1, -1, 0)).toBe(false);
      expect(isPositionEmpty(gameState.boards.player1, 5, 0)).toBe(false);
    });
  });

  describe("Ship Placement Validation", () => {
    test("should detect when all ships are placed", () => {
      const ships = [
        {
          type: "destroyer" as ShipType,
          positions: [],
          orientation: "horizontal" as ShipOrientation,
          hits: 0,
          sunk: false,
        },
        {
          type: "battleship" as ShipType,
          positions: [],
          orientation: "horizontal" as ShipOrientation,
          hits: 0,
          sunk: false,
        },
      ];
      expect(allShipsPlaced(ships)).toBe(true);
    });

    test("should detect when not all ships are placed", () => {
      const ships = [
        {
          type: "destroyer" as ShipType,
          positions: [],
          orientation: "horizontal" as ShipOrientation,
          hits: 0,
          sunk: false,
        },
      ];
      expect(allShipsPlaced(ships)).toBe(false);
    });

    test("should validate correct ship placement", () => {
      const board = Array(5)
        .fill(null)
        .map(() => Array(5).fill("empty"));
      expect(
        isValidShipPlacement(board, "destroyer", [0, 0], "horizontal"),
      ).toBe(true);
      expect(
        isValidShipPlacement(board, "battleship", [0, 0], "horizontal"),
      ).toBe(true);
      expect(isValidShipPlacement(board, "destroyer", [0, 0], "vertical")).toBe(
        true,
      );
      expect(
        isValidShipPlacement(board, "battleship", [0, 1], "vertical"),
      ).toBe(true);
    });

    test("should reject ship placement that goes out of bounds", () => {
      const board = Array(5)
        .fill(null)
        .map(() => Array(5).fill("empty"));
      expect(
        isValidShipPlacement(board, "destroyer", [0, 3], "horizontal"),
      ).toBe(false);
      expect(
        isValidShipPlacement(board, "battleship", [0, 2], "horizontal"),
      ).toBe(false);
      expect(isValidShipPlacement(board, "destroyer", [3, 0], "vertical")).toBe(
        false,
      );
      expect(
        isValidShipPlacement(board, "battleship", [2, 0], "vertical"),
      ).toBe(false);
    });

    test("should reject ship placement on occupied positions", () => {
      const board = Array(5)
        .fill(null)
        .map(() => Array(5).fill("empty"));
      board[0][0] = "ship";
      board[0][1] = "ship";
      expect(
        isValidShipPlacement(board, "destroyer", [0, 0], "horizontal"),
      ).toBe(false);
      expect(
        isValidShipPlacement(board, "destroyer", [0, 1], "horizontal"),
      ).toBe(false);
    });
  });

  describe("Ship Placement", () => {
    test("should place horizontal ship correctly", () => {
      const board = Array(5)
        .fill(null)
        .map(() => Array(5).fill("empty"));
      const ships: any[] = [];

      const { board: newBoard, ships: newShips } = placeShip(
        board,
        ships,
        "destroyer",
        [0, 0],
        "horizontal",
      );

      expect(newBoard[0][0]).toBe("ship");
      expect(newBoard[0][1]).toBe("ship");
      expect(newBoard[0][2]).toBe("ship");
      expect(newShips[0].type).toBe("destroyer");
      expect(newShips[0].orientation).toBe("horizontal");
      expect(newShips[0].positions).toEqual([
        [0, 0],
        [0, 1],
        [0, 2],
      ]);
    });

    test("should place vertical ship correctly", () => {
      const board = Array(5)
        .fill(null)
        .map(() => Array(5).fill("empty"));
      const ships: any[] = [];

      const { board: newBoard, ships: newShips } = placeShip(
        board,
        ships,
        "battleship",
        [1, 1],
        "vertical",
      );

      expect(newBoard[1][1]).toBe("ship");
      expect(newBoard[2][1]).toBe("ship");
      expect(newBoard[3][1]).toBe("ship");
      expect(newBoard[4][1]).toBe("ship");
      expect(newShips[0].type).toBe("battleship");
      expect(newShips[0].orientation).toBe("vertical");
      expect(newShips[0].positions).toEqual([
        [1, 1],
        [2, 1],
        [3, 1],
        [4, 1],
      ]);
    });
  });

  describe("Ship Sinking", () => {
    test("should detect sunk ship", () => {
      const ship = {
        type: "destroyer" as ShipType,
        positions: [],
        orientation: "horizontal" as ShipOrientation,
        hits: 3,
        sunk: false,
      };
      expect(isShipSunk(ship)).toBe(true);
    });

    test("should detect non-sunk ship", () => {
      const ship = {
        type: "destroyer" as ShipType,
        positions: [],
        orientation: "horizontal" as ShipOrientation,
        hits: 2,
        sunk: false,
      };
      expect(isShipSunk(ship)).toBe(false);
    });
  });

  describe("Firing Shots", () => {
    test("should handle hit correctly", () => {
      const board = Array(5)
        .fill(null)
        .map(() => Array(5).fill("empty"));
      board[0][0] = "ship";
      const ships: any[] = [
        {
          type: "destroyer" as ShipType,
          positions: [
            [0, 0] as [number, number],
            [0, 1] as [number, number],
            [0, 2] as [number, number],
          ],
          orientation: "horizontal" as ShipOrientation,
          hits: 0,
          sunk: false,
        },
      ];

      const {
        board: newBoard,
        ships: newShips,
        result,
      } = fireShot(board, ships, [0, 0]);

      expect(result).toBe("hit");
      expect(newBoard[0][0]).toBe("hit");
      expect(newShips[0].hits).toBe(1);
    });

    test("should handle miss correctly", () => {
      const board = Array(5)
        .fill(null)
        .map(() => Array(5).fill("empty"));
      const ships: any[] = [];

      const {
        board: newBoard,
        ships: newShips,
        result,
      } = fireShot(board, ships, [0, 0]);

      expect(result).toBe("miss");
      expect(newBoard[0][0]).toBe("miss");
      expect(newShips).toEqual(ships);
    });

    test("should handle ship sinking correctly", () => {
      const board = Array(5)
        .fill(null)
        .map(() => Array(5).fill("empty"));
      board[0][0] = "ship";
      board[0][1] = "ship";
      board[0][2] = "ship";
      const ships: any[] = [
        {
          type: "destroyer" as ShipType,
          positions: [
            [0, 0] as [number, number],
            [0, 1] as [number, number],
            [0, 2] as [number, number],
          ],
          orientation: "horizontal" as ShipOrientation,
          hits: 2,
          sunk: false,
        },
      ];

      const {
        board: newBoard,
        ships: newShips,
        result,
      } = fireShot(board, ships, [0, 1]);

      expect(result).toBe("sunk");
      expect(newBoard[0][0]).toBe("sunk");
      expect(newBoard[0][1]).toBe("sunk");
      expect(newBoard[0][2]).toBe("sunk");
      expect(newShips[0].sunk).toBe(true);
    });
  });

  describe("Game Over Detection", () => {
    test("should detect game over when all ships are sunk", () => {
      const state = {
        ...gameState,
        status: "playing" as const,
        ships: {
          player1: [
            {
              type: "destroyer" as ShipType,
              positions: [],
              orientation: "horizontal" as ShipOrientation,
              hits: 3,
              sunk: true,
            },
            {
              type: "battleship" as ShipType,
              positions: [],
              orientation: "horizontal" as ShipOrientation,
              hits: 4,
              sunk: true,
            },
          ],
          player2: [
            {
              type: "destroyer" as ShipType,
              positions: [],
              orientation: "horizontal" as ShipOrientation,
              hits: 0,
              sunk: false,
            },
            {
              type: "battleship" as ShipType,
              positions: [],
              orientation: "horizontal" as ShipOrientation,
              hits: 0,
              sunk: false,
            },
          ],
        },
      };

      expect(isGameOver(state)).toBe(true);
    });

    test("should not detect game over when ships remain", () => {
      const state = {
        ...gameState,
        status: "playing" as const,
        ships: {
          player1: [
            {
              type: "destroyer" as ShipType,
              positions: [],
              orientation: "horizontal" as ShipOrientation,
              hits: 0,
              sunk: false,
            },
            {
              type: "battleship" as ShipType,
              positions: [],
              orientation: "horizontal" as ShipOrientation,
              hits: 0,
              sunk: false,
            },
          ],
          player2: [
            {
              type: "destroyer" as ShipType,
              positions: [],
              orientation: "horizontal" as ShipOrientation,
              hits: 0,
              sunk: false,
            },
            {
              type: "battleship" as ShipType,
              positions: [],
              orientation: "horizontal" as ShipOrientation,
              hits: 0,
              sunk: false,
            },
          ],
        },
      };

      expect(isGameOver(state)).toBe(false);
    });

    test("should not detect game over when not in playing state", () => {
      const state = {
        ...gameState,
        status: "setup" as const,
        ships: {
          player1: [
            {
              type: "destroyer" as ShipType,
              positions: [],
              orientation: "horizontal" as ShipOrientation,
              hits: 3,
              sunk: true,
            },
            {
              type: "battleship" as ShipType,
              positions: [],
              orientation: "horizontal" as ShipOrientation,
              hits: 4,
              sunk: true,
            },
          ],
          player2: [
            {
              type: "destroyer" as ShipType,
              positions: [],
              orientation: "horizontal" as ShipOrientation,
              hits: 3,
              sunk: true,
            },
            {
              type: "battleship" as ShipType,
              positions: [],
              orientation: "horizontal" as ShipOrientation,
              hits: 4,
              sunk: true,
            },
          ],
        },
      };

      expect(isGameOver(state)).toBe(false);
    });
  });

  describe("Action Validation", () => {
    test("should reject finished game actions", async () => {
      const state = {
        ...gameState,
        status: "finished" as const,
      };

      const action = {
        type: "place_ship" as const,
        playerId: "player1",
        shipType: "destroyer" as ShipType,
        position: [0, 0] as [number, number],
        orientation: "horizontal" as ShipOrientation,
        timestamp: new Date(),
      };

      const result = await validateAction(state, action, "player1");
      expect(result.valid).toBe(false);
      expect(result.message).toBe("Game is already finished");
    });

    test("should validate ship placement action", async () => {
      const state = {
        ...gameState,
        status: "setup" as const,
        players: {
          player1: "player1",
          player2: null,
        },
      };

      const action = {
        type: "place_ship" as const,
        playerId: "player1",
        shipType: "destroyer" as ShipType,
        position: [0, 0] as [number, number],
        orientation: "horizontal" as ShipOrientation,
        timestamp: new Date(),
      };

      const result = await validateAction(state, action, "player1");
      expect(result.valid).toBe(true);
    });

    test("should reject invalid ship placement", async () => {
      const state = {
        ...gameState,
        status: "setup" as const,
        players: {
          player1: "player1",
          player2: null,
        },
        boards: {
          player1: Array(5)
            .fill(null)
            .map(() => Array(5).fill("ship")),
          player2: Array(5)
            .fill(null)
            .map(() => Array(5).fill("empty")),
        },
      };

      const action = {
        type: "place_ship" as const,
        playerId: "player1",
        shipType: "destroyer" as ShipType,
        position: [0, 0] as [number, number],
        orientation: "horizontal" as ShipOrientation,
        timestamp: new Date(),
      };

      const result = await validateAction(state, action, "player1");
      expect(result.valid).toBe(false);
      expect(result.message).toBe("Invalid ship placement");
    });

    test("should validate fire shot action", async () => {
      const state = {
        ...gameState,
        status: "playing" as const,
        players: {
          player1: "player1",
          player2: "player2",
        },
        currentPlayer: "player1" as Player,
      };

      const action = {
        type: "fire_shot" as const,
        playerId: "player1",
        position: [0, 0] as [number, number],
        timestamp: new Date(),
      };

      const result = await validateAction(state, action, "player1");
      expect(result.valid).toBe(true);
    });

    test("should reject fire shot when not player's turn", async () => {
      const state = {
        ...gameState,
        status: "playing" as const,
        players: {
          player1: "player1",
          player2: "player2",
        },
        currentPlayer: "player2" as Player,
      };

      const action = {
        type: "fire_shot" as const,
        playerId: "player1",
        position: [0, 0] as [number, number],
        timestamp: new Date(),
      };

      const result = await validateAction(state, action, "player1");
      expect(result.valid).toBe(false);
      expect(result.message).toBe("It's not player1's turn");
    });
  });

  describe("Action Execution", () => {
    test("should execute ship placement", async () => {
      const state = {
        ...gameState,
        status: "setup" as const,
        players: {
          player1: "player1",
          player2: null,
        },
      };

      const action = {
        type: "place_ship" as const,
        playerId: "player1",
        shipType: "destroyer" as ShipType,
        position: [0, 0] as [number, number],
        orientation: "horizontal" as ShipOrientation,
        timestamp: new Date(),
      };

      const result = await executeAction(state, action, "player1");

      expect(result.success).toBe(true);
      expect(result.state.boards.player1[0][0]).toBe("ship");
      expect(result.state.boards.player1[0][1]).toBe("ship");
      expect(result.state.boards.player1[0][2]).toBe("ship");
      expect(result.state.ships.player1[0].type).toBe("destroyer");
    });

    test("should execute fire shot", async () => {
      const state = {
        ...gameState,
        status: "playing" as const,
        players: {
          player1: "player1",
          player2: "player2",
        },
        currentPlayer: "player1" as Player,
        boards: {
          player1: Array(5)
            .fill(null)
            .map(() => Array(5).fill("empty")),
          player2: Array(5)
            .fill(null)
            .map(() => Array(5).fill("empty")),
        },
      };

      // Place a ship for player2 first
      state.boards.player2[0][0] = "ship";
      state.boards.player2[0][1] = "ship";
      state.boards.player2[0][2] = "ship";

      const action = {
        type: "fire_shot" as const,
        playerId: "player1",
        position: [0, 0] as [number, number],
        timestamp: new Date(),
      };

      const result = await executeAction(state, action, "player1");

      expect(result.success).toBe(true);
      expect(result.state.boards.player2[0][0]).toBe("hit");
      expect(result.state.currentPlayer).toBe("player2");
    });

    test("should detect game over after all ships sunk", async () => {
      const state = {
        ...gameState,
        status: "playing" as const,
        players: {
          player1: "player1",
          player2: "player2",
        },
        currentPlayer: "player1" as Player,
        boards: {
          player1: Array(5)
            .fill(null)
            .map(() => Array(5).fill("empty")),
          player2: Array(5)
            .fill(null)
            .map(() => Array(5).fill("empty")),
        },
        ships: {
          player1: [
            {
              type: "destroyer" as ShipType,
              positions: [
                [0, 0] as [number, number],
                [0, 1] as [number, number],
                [0, 2] as [number, number],
              ],
              orientation: "horizontal" as ShipOrientation,
              hits: 2,
              sunk: false,
            },
            {
              type: "battleship" as ShipType,
              positions: [
                [1, 0] as [number, number],
                [2, 0] as [number, number],
                [3, 0] as [number, number],
                [4, 0] as [number, number],
              ],
              orientation: "vertical" as ShipOrientation,
              hits: 3,
              sunk: false,
            },
          ],
          player2: [
            {
              type: "destroyer" as ShipType,
              positions: [
                [0, 0] as [number, number],
                [0, 1] as [number, number],
                [0, 2] as [number, number],
              ],
              orientation: "horizontal" as ShipOrientation,
              hits: 3,
              sunk: true,
            },
            {
              type: "battleship" as ShipType,
              positions: [
                [1, 0] as [number, number],
                [2, 0] as [number, number],
                [3, 0] as [number, number],
                [4, 0] as [number, number],
              ],
              orientation: "vertical" as ShipOrientation,
              hits: 4,
              sunk: true,
            },
          ],
        },
      };

      const action = {
        type: "fire_shot" as const,
        playerId: "player1",
        position: [0, 0] as [number, number],
        timestamp: new Date(),
      };

      const result = await executeAction(state, action, "player1");

      expect(result.success).toBe(true);
      expect(result.gameOver).toBe(true);
      expect(result.state.status).toBe("finished");
      expect(result.state.winner).toBe("player1");
    });
  });

  describe("Player Management", () => {
    test("should add player correctly", () => {
      const state = addPlayer(gameState, "player1", "player1");

      expect(state.players.player1).toBe("player1");
      expect(state.updatedAt.getTime()).toBeGreaterThanOrEqual(
        gameState.updatedAt.getTime(),
      );
      expect(gameState.players.player1).toBeNull();
    });

    test("should remove player correctly", () => {
      const stateWithPlayer = addPlayer(gameState, "player1", "player1");
      const state = removePlayer(stateWithPlayer, "player1");

      expect(state.players.player1).toBe(null);
      expect(state.status).toBe("setup");
      expect(state.currentPlayer).toBe("player1");
      expect(state.winner).toBe(null);
    });
  });

  describe("State Filtering", () => {
    test("should filter state for player1", () => {
      const state = {
        ...gameState,
        players: {
          player1: "player1",
          player2: "player2",
        },
        boards: {
          player1: Array(5)
            .fill(null)
            .map(() => Array(5).fill("ship")),
          player2: Array(5)
            .fill(null)
            .map(() => Array(5).fill("ship")),
        },
        ships: {
          player1: [
            {
              type: "destroyer" as ShipType,
              positions: [],
              orientation: "horizontal" as ShipOrientation,
              hits: 0,
              sunk: false,
            },
            {
              type: "battleship" as ShipType,
              positions: [],
              orientation: "horizontal" as ShipOrientation,
              hits: 0,
              sunk: false,
            },
          ],
          player2: [
            {
              type: "destroyer" as ShipType,
              positions: [],
              orientation: "horizontal" as ShipOrientation,
              hits: 0,
              sunk: false,
            },
            {
              type: "battleship" as ShipType,
              positions: [],
              orientation: "horizontal" as ShipOrientation,
              hits: 0,
              sunk: false,
            },
          ],
        },
      };

      const filteredState = filterStateForPlayer(state, "player1");

      expect(filteredState.boards.player1).toEqual(state.boards.player1);
      expect(filteredState.boards.player2).toEqual(
        Array(5)
          .fill(null)
          .map(() => Array(5).fill("empty")),
      );
      expect(filteredState.ships.player1).toHaveLength(2);
      expect(filteredState.ships.player2).toHaveLength(0);
    });

    test("should filter state for player2", () => {
      const state = {
        ...gameState,
        players: {
          player1: "player1",
          player2: "player2",
        },
        boards: {
          player1: Array(5)
            .fill(null)
            .map(() => Array(5).fill("ship")),
          player2: Array(5)
            .fill(null)
            .map(() => Array(5).fill("ship")),
        },
        ships: {
          player1: [
            {
              type: "destroyer" as ShipType,
              positions: [],
              orientation: "horizontal" as ShipOrientation,
              hits: 0,
              sunk: false,
            },
            {
              type: "battleship" as ShipType,
              positions: [],
              orientation: "horizontal" as ShipOrientation,
              hits: 0,
              sunk: false,
            },
          ],
          player2: [
            {
              type: "destroyer" as ShipType,
              positions: [],
              orientation: "horizontal" as ShipOrientation,
              hits: 0,
              sunk: false,
            },
            {
              type: "battleship" as ShipType,
              positions: [],
              orientation: "horizontal" as ShipOrientation,
              hits: 0,
              sunk: false,
            },
          ],
        },
      };

      const filteredState = filterStateForPlayer(state, "player2");

      expect(filteredState.boards.player2).toEqual(state.boards.player2);
      expect(filteredState.boards.player1).toEqual(
        Array(5)
          .fill(null)
          .map(() => Array(5).fill("empty")),
      );
      expect(filteredState.ships.player2).toHaveLength(2);
      expect(filteredState.ships.player1).toHaveLength(0);
    });
  });

  describe("Rules", () => {
    const place = (
      shipType: ShipType,
      position: [number, number],
      orientation: ShipOrientation = "horizontal",
    ) => ({ type: "place_ship" as const, shipType, position, orientation });

    const play = async (
      state: ReturnType<typeof createInitialGameState>,
      playerId: string,
      action: Parameters<typeof executeAction>[1],
    ) => {
      const validation = await validateAction(state, action, playerId);
      if (!validation.valid) throw new Error(validation.message);
      return (await executeAction(state, action, playerId)).state;
    };

    /** Both players seated, destroyer on row 0 and battleship on row 1 */
    const startedGame = async () => {
      let state = createInitialGameState("");
      state = await play(state, "alice", { type: "join" });
      state = await play(state, "bob", { type: "join" });
      for (const player of ["alice", "bob"]) {
        state = await play(state, player, place("destroyer", [0, 0]));
        state = await play(state, player, place("battleship", [1, 0]));
      }
      return state;
    };

    test("seats players in join order and rejects a third", async () => {
      let state = await play(gameState, "alice", { type: "join" });
      state = await play(state, "bob", { type: "join" });

      expect(seatOf(state, "alice")).toBe("player1");
      expect(seatOf(state, "bob")).toBe("player2");
      expect(
        (await validateAction(state, { type: "join" }, "carol")).message,
      ).toBe("Both seats are taken");
    });

    test("rejects ship placement by players without a seat", async () => {
      const result = await validateAction(
        gameState,
        place("destroyer", [0, 0]),
        "alice",
      );
      expect(result.message).toBe("Join the game first");
    });

    test("rejects placing the same ship type twice", async () => {
      let state = await play(gameState, "alice", { type: "join" });
      state = await play(state, "alice", place("destroyer", [0, 0]));

      const result = await validateAction(
        state,
        place("destroyer", [2, 0]),
        "alice",
      );
      expect(result.message).toBe("Destroyer already placed");
    });

    test("starts once both players have placed all ships", async () => {
      const state = await startedGame();
      expect(state.status).toBe("playing");
      expect(state.currentPlayer).toBe("player1");

      const late = await validateAction(
        state,
        place("destroyer", [3, 0]),
        "alice",
      );
      expect(late.message).toBe("Ships can only be placed during setup");
    });

    test("hits a ship cell and rejects firing at it again", async () => {
      let state = await startedGame();
      state = await play(state, "alice", {
        type: "fire_shot",
        position: [0, 0],
      });

      expect(state.boards.player2[0][0]).toBe("hit");
      expect(state.lastMove.result).toBe("hit");
      state = await play(state, "bob", { type: "fire_shot", position: [4, 4] });

      const again = await validateAction(
        state,
        { type: "fire_shot", position: [0, 0] },
        "alice",
      );
      expect(again.message).toBe("Position already fired at");
    });

    test("ends the game when every ship of the opponent is sunk", async () => {
      let state = await startedGame();
      const targets: [number, number][] = [
        [0, 0],
        [0, 1],
        [0, 2],
        [1, 0],
        [1, 1],
        [1, 2],
        [1, 3],
      ];
      const misses: [number, number][] = [
        [4, 0],
        [4, 1],
        [4, 2],
        [4, 3],
        [4, 4],
        [3, 0],
      ];
      for (const [index, target] of targets.entries()) {
        state = await play(state, "alice", {
          type: "fire_shot",
          position: target,
        });
        if (index < misses.length) {
          state = await play(state, "bob", {
            type: "fire_shot",
            position: misses[index],
          });
        }
      }

      expect(state.status).toBe("finished");
      expect(state.winner).toBe("player1");
      expect(
        (
          await validateAction(
            state,
            { type: "fire_shot", position: [3, 1] },
            "bob",
          )
        ).message,
      ).toBe("Game is already finished");
    });

    test("allows a restart after the game is finished", async () => {
      const state = {
        ...(await startedGame()),
        status: "finished" as const,
        winner: "player1" as Player,
      };
      const restarted = await play(state, "bob", { type: "restart" });

      expect(restarted.status).toBe("setup");
      expect(restarted.winner).toBeNull();
      expect(restarted.players).toEqual(state.players);
    });

    test("does not mutate the state it is given", async () => {
      const state = await startedGame();
      const before = JSON.stringify(state);
      await executeAction(
        state,
        { type: "fire_shot", position: [0, 0] },
        "alice",
      );
      expect(JSON.stringify(state)).toBe(before);
    });

    test("shows players without a seat no ships", async () => {
      const state = await startedGame();
      const view = filterStateForPlayer(state, "carol");

      expect(view.boards.player1.flat()).not.toContain("ship");
      expect(view.boards.player2.flat()).not.toContain("ship");
      expect(view.ships).toEqual({ player1: [], player2: [] });
      expect(view.players).toEqual({
        player1: "opponent",
        player2: "opponent",
      });
    });
  });
});
