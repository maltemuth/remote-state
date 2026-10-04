/**
 * Plays one complete battleship game between two simulated players: both place
 * their fleets, then player 1 sinks player 2's fleet while player 2 misses. Every
 * action is timed until its HTTP response, and until the other player's socket
 * receives the update.
 */

import type { BattleshipAction } from "../games/battleship/types.js";
import type { Format } from "@malte.muth/remote-state";
import { joinPlayer, type Player, postJson } from "./player.js";

export interface Samples {
  /** Milliseconds from sending an action to its HTTP response */
  http: number[];
  /** Milliseconds from sending an action to the other player receiving the update */
  endToEnd: number[];
  errors: number;
}

export interface GameOptions {
  base: string;
  format: Format;
  /** Average milliseconds a player thinks before each action */
  pause: number;
}

const fleet: BattleshipAction[] = [
  {
    type: "place_ship",
    shipType: "destroyer",
    position: [0, 0],
    orientation: "horizontal",
  },
  {
    type: "place_ship",
    shipType: "battleship",
    position: [1, 0],
    orientation: "horizontal",
  },
];
const hits: [number, number][] = [
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

/** The 17 actions of a game, as [actor, action]; actor 0 is player 1 */
const script: [0 | 1, BattleshipAction][] = [
  ...fleet.map((action): [0, BattleshipAction] => [0, action]),
  ...fleet.map((action): [1, BattleshipAction] => [1, action]),
  ...hits.flatMap((position, i): [0 | 1, BattleshipAction][] => [
    [0, { type: "fire_shot", position }],
    ...(i < misses.length
      ? [
          [1, { type: "fire_shot", position: misses[i] }] as [
            1,
            BattleshipAction,
          ],
        ]
      : []),
  ]),
];

export const ACTIONS_PER_GAME = script.length;

export const playGame = async (
  { base, format, pause }: GameOptions,
  samples: Samples,
) => {
  const { gameId } = (await postJson(`${base}/battleship/lobby/games`))
    .body as {
    gameId: string;
  };
  const players: Player[] = [
    await joinPlayer(base, gameId, "A", format),
    await joinPlayer(base, gameId, "B", format),
  ];
  for (const [actor, action] of script) {
    if (pause)
      await new Promise((r) => setTimeout(r, pause * (0.5 + Math.random())));
    const started = performance.now();
    const { status, body } = await postJson(
      `${base}/battleship/api/games/${gameId}/actions`,
      { action },
      players[actor].token,
    );
    samples.http.push(performance.now() - started);
    if (status !== 201) {
      samples.errors++;
      continue;
    }
    const seen = await players[1 - actor].arrival(body.sequence as number);
    samples.endToEnd.push(seen - started);
  }
  players.forEach((player) => player.disconnect());
};
