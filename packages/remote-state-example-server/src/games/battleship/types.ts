/**
 * Battleship's state, actions and ships, by the classic rules: a 10×10 board per
 * player, and a fleet of a carrier (5), a battleship (4), a cruiser (3), a
 * submarine (3) and a destroyer (2).
 */

export type Player = "player1" | "player2";
export type ShipType =
  "carrier" | "battleship" | "cruiser" | "submarine" | "destroyer";
export type ShipOrientation = "horizontal" | "vertical";

export type CellState = "empty" | "ship" | "hit" | "miss" | "sunk";
export type Board = CellState[][];

export interface ShipPosition {
  type: ShipType;
  /** The [row, col] cells the ship covers */
  positions: [number, number][];
  orientation: ShipOrientation;
  hits: number;
  sunk: boolean;
}

export type GameStatus = "setup" | "playing" | "finished";

/** What clients send; players join through admission, not as an action */
export type BattleshipAction =
  | {
      type: "place_ship";
      shipType: ShipType;
      position: [number, number];
      orientation: ShipOrientation;
    }
  | { type: "fire_shot"; position: [number, number] }
  | { type: "restart" };

export interface BattleshipState {
  boards: Record<Player, Board>;
  ships: Record<Player, ShipPosition[]>;
  currentPlayer: Player;
  status: GameStatus;
  winner: Player | null;
  /** Player IDs per seat */
  players: Record<Player, string | null>;
  lastMove: {
    player: Player;
    action: "place_ship" | "fire_shot";
    position: [number, number];
    result: "hit" | "miss" | "sunk" | null;
  } | null;
}

export const BOARD_SIZE = 10;

/** Cells per ship; every player places each ship once */
export const SHIP_SIZES: Record<ShipType, number> = {
  carrier: 5,
  battleship: 4,
  cruiser: 3,
  submarine: 3,
  destroyer: 2,
};

const emptyBoard = (): Board =>
  Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill("empty"));

/** A game with both seats free, for the host to pass to `createGame` */
export const newBattleshipGame = (): BattleshipState => ({
  boards: { player1: emptyBoard(), player2: emptyBoard() },
  ships: { player1: [], player2: [] },
  currentPlayer: "player1",
  status: "setup",
  winner: null,
  players: { player1: null, player2: null },
  lastMove: null,
});
