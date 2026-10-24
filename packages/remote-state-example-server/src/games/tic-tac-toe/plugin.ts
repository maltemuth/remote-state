/**
 * Tic-tac-toe as a Remote State game: the first two people admitted get X and O,
 * everyone after that is refused. No view filter, since nothing is hidden. With a
 * time limit, a turn timer runs while the game does, and a server restart pauses
 * the game until the host resumes it.
 */

import { Refusal, type Rules } from "@malte.muth/remote-state";
import { pauseOnRestart } from "./restart.js";
import { applyAction, checkAction, freeMark } from "./rules.js";
import { withTurnTimer } from "./turnTimer.js";
import type { TicTacToeAction, TicTacToeState } from "./types.js";

export const ticTacToeRules: Rules<TicTacToeState, TicTacToeAction> = {
  onRestart: pauseOnRestart,
  onJoin: (state, { memberId: playerId, details }) => {
    const mark = freeMark(state);
    if (!mark) throw new Refusal("Both seats are taken");
    const name =
      typeof details.name === "string" && details.name
        ? details.name
        : `Player ${mark}`;
    return withTurnTimer({
      ...state,
      seats: { ...state.seats, [mark]: { playerId, name } },
    });
  },
  validateAction: checkAction,
  executeAction: (state, action) => withTurnTimer(applyAction(state, action)),
};
