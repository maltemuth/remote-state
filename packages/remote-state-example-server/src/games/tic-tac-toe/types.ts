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
  | { winner: Mark; line: Position[] }
  | { winner: Mark; timeout: true }
  | { winner: null; draw: true }
  | null;

export interface TicTacToeState {
  board: Board;
  seats: Partial<Record<Mark, Seat>>;
  /** Who moved first this round; rematches alternate */
  starter: Mark;
  turn: Mark;
  outcome: Outcome;
  /** Seconds per move before the player to move loses, or null for no limit */
  turnSeconds: number | null;
  /** Stopped by a server restart, which lost the turn timer, until the host resumes it */
  paused: boolean;
}

export type TicTacToeAction =
  | { type: "place"; row: number; col: number }
  | { type: "rematch" }
  /** Sent by the host, once both players are back after a restart */
  | { type: "resume" }
  /** Sent by the system when a turn's time runs out; `moves` is the number of marks on the board then */
  | { type: "timeout"; moves: number };
