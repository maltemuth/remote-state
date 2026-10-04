/**
 * Tic-tac-toe's state and actions. There's no hidden information, so every player
 * and spectator sees the full state.
 */

export type Mark = "X" | "O";
export type Cell = Mark | null;
/** Three rows of three cells */
export type Board = Cell[][];
export type Position = [row: number, col: number];

export interface Seat {
  playerId: string;
  name: string;
}

export type Outcome =
  { winner: Mark; line: Position[] } | { winner: null; draw: true } | null;

export interface TicTacToeState {
  board: Board;
  seats: Partial<Record<Mark, Seat>>;
  /** Who moved first this round; rematches alternate */
  starter: Mark;
  turn: Mark;
  outcome: Outcome;
}

export type TicTacToeAction =
  { type: "place"; row: number; col: number } | { type: "rematch" };
