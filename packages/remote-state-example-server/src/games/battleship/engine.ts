/**
 * Battleship's rules as plain functions: checking an action, applying it with
 * Immer, and what each player may see.
 */

import { produce } from "immer";
import {
  BOARD_SIZE,
  type BattleshipAction,
  type BattleshipState,
  type Board,
  type CellState,
  newBattleshipGame,
  type Player,
  SHIP_SIZES,
  type ShipOrientation,
  type ShipPosition,
} from "./types.js";

const onBoard = (row: number, col: number) =>
  Number.isInteger(row) &&
  Number.isInteger(col) &&
  row >= 0 &&
  row < BOARD_SIZE &&
  col >= 0 &&
  col < BOARD_SIZE;

const isPosition = (position: unknown): position is [number, number] =>
  Array.isArray(position) &&
  position.length === 2 &&
  onBoard(position[0], position[1]);

/** The cells a ship of this size covers from `position`, on the board or not */
export const cellsOf = (
  [row, col]: [number, number],
  orientation: ShipOrientation,
  size: number,
): [number, number][] =>
  Array.from({ length: size }, (_, i) =>
    orientation === "horizontal" ? [row, col + i] : [row + i, col],
  );

const opponentOf = (seat: Player): Player =>
  seat === "player1" ? "player2" : "player1";

/** The seat a player occupies, or null without one */
export const seatOf = (
  state: BattleshipState,
  playerId: string,
): Player | null =>
  state.players.player1 === playerId
    ? "player1"
    : state.players.player2 === playerId
      ? "player2"
      : null;

const allShipsPlaced = (ships: ShipPosition[]) =>
  Object.keys(SHIP_SIZES).every((type) => ships.some((s) => s.type === type));

const alreadyTargeted: CellState[] = ["hit", "miss", "sunk"];

/** `true`, or why the action isn't allowed. Actions come from clients unchecked. */
export const validateAction = (
  state: BattleshipState,
  action: BattleshipAction,
  playerId: string,
): true | string => {
  const seat = seatOf(state, playerId);
  if (!seat) return "Only seated players can act";

  switch (action?.type) {
    case "restart":
      return true;

    case "place_ship": {
      if (state.status !== "setup")
        return "Ships can only be placed during setup";
      const { shipType, position, orientation } = action;
      // Own keys only: `in` would also accept inherited names such as toString
      if (!Object.hasOwn(SHIP_SIZES, shipType)) {
        return `Unknown ship type ${shipType}`;
      }
      if (orientation !== "horizontal" && orientation !== "vertical") {
        return "Orientation must be horizontal or vertical";
      }
      if (!isPosition(position))
        return `Position must be [row, col] between 0 and ${BOARD_SIZE - 1}`;
      if (state.ships[seat].some((ship) => ship.type === shipType)) {
        return `${shipType} already placed`;
      }
      const cells = cellsOf(position, orientation, SHIP_SIZES[shipType]);
      const free = ([r, c]: [number, number]) =>
        onBoard(r, c) && state.boards[seat][r][c] === "empty";
      return cells.every(free) || "Invalid ship placement";
    }

    case "fire_shot": {
      if (state.status === "finished") return "Game is already finished";
      if (state.status !== "playing") return "Game is not in playing state";
      if (seat !== state.currentPlayer) return `It's not ${playerId}'s turn`;
      if (!isPosition(action.position)) {
        return `Position must be [row, col] between 0 and ${BOARD_SIZE - 1}`;
      }
      const [row, col] = action.position;
      const cell = state.boards[opponentOf(seat)][row][col];
      return !alreadyTargeted.includes(cell) || "Position already fired at";
    }

    default:
      // Anything a client sent, not only the declared actions
      return `Unknown action type ${String((action as { type?: unknown })?.type)}`;
  }
};

/** Apply an action that `validateAction` accepted */
export const executeAction = (
  state: BattleshipState,
  action: BattleshipAction,
  playerId: string,
): BattleshipState => {
  if (action.type === "restart") {
    return { ...newBattleshipGame(), players: state.players };
  }
  return produce(state, (draft) => {
    if (action.type === "place_ship") {
      const seat = seatOf(state, playerId)!;
      const { shipType, position, orientation } = action;
      const positions = cellsOf(position, orientation, SHIP_SIZES[shipType]);
      positions.forEach(([r, c]) => (draft.boards[seat][r][c] = "ship"));
      draft.ships[seat].push({
        type: shipType,
        positions,
        orientation,
        hits: 0,
        sunk: false,
      });
      draft.lastMove = {
        player: seat,
        action: "place_ship",
        position,
        result: null,
      };
      if (
        allShipsPlaced(draft.ships.player1) &&
        allShipsPlaced(draft.ships.player2)
      ) {
        draft.status = "playing";
        draft.currentPlayer = "player1";
      }
      return;
    }

    const shooter = draft.currentPlayer;
    const target = opponentOf(shooter);
    const board = draft.boards[target];
    const [row, col] = action.position;
    let result: "hit" | "miss" | "sunk" = "miss";
    if (board[row][col] === "ship") {
      board[row][col] = "hit";
      result = "hit";
      const ship = draft.ships[target].find((s) =>
        s.positions.some(([r, c]) => r === row && c === col),
      )!;
      ship.hits++;
      if (ship.hits === SHIP_SIZES[ship.type]) {
        ship.sunk = true;
        result = "sunk";
        ship.positions.forEach(([r, c]) => (board[r][c] = "sunk"));
      }
    } else {
      board[row][col] = "miss";
    }
    draft.lastMove = {
      player: shooter,
      action: "fire_shot",
      position: [row, col],
      result,
    };

    if (draft.ships[target].every((ship) => ship.sunk)) {
      draft.status = "finished";
      draft.winner = shooter;
    } else {
      draft.currentPlayer = target;
    }
  });
};

const hideShips = (board: Board): Board =>
  board.map((row) => row.map((cell) => (cell === "ship" ? "empty" : cell)));

/**
 * What one player sees: their own board and ships, only shots and sunk ships on
 * the opponent's board, and the opponent's player ID as "opponent". Players
 * without a seat see no ships at all.
 */
export const filterStateForPlayer = (
  state: BattleshipState,
  playerId: string,
): BattleshipState => {
  const seat = seatOf(state, playerId);
  const view = (player: Player) => player === seat;
  const maskId = (id: string | null) =>
    id === null || id === playerId ? id : "opponent";

  return {
    ...state,
    boards: {
      player1: view("player1")
        ? state.boards.player1
        : hideShips(state.boards.player1),
      player2: view("player2")
        ? state.boards.player2
        : hideShips(state.boards.player2),
    },
    ships: {
      player1: view("player1") ? state.ships.player1 : [],
      player2: view("player2") ? state.ships.player2 : [],
    },
    players: {
      player1: maskId(state.players.player1),
      player2: maskId(state.players.player2),
    },
  };
};
