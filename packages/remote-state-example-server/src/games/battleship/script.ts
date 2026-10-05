/**
 * A complete battleship game by script, for the load test and tests: both players
 * place their ships one per row from the top left, then player 1 sinks every ship
 * while player 2 misses in the bottom rows.
 */

import {
  BOARD_SIZE,
  type BattleshipAction,
  SHIP_SIZES,
  type ShipType,
} from "./types.js";

/** Each ship horizontally in its own row, from column 0 */
export const FLEET: BattleshipAction[] = (
  Object.keys(SHIP_SIZES) as ShipType[]
).map((shipType, row) => ({
  type: "place_ship",
  shipType,
  position: [row, 0],
  orientation: "horizontal",
}));

/** Every cell of the fleet: the shots that sink it, the last one ending the game */
export const HITS: [number, number][] = Object.values(SHIP_SIZES).flatMap(
  (size, row) =>
    Array.from({ length: size }, (_, col): [number, number] => [row, col]),
);

/** Empty cells from the bottom row up, one between each two hits */
export const MISSES: [number, number][] = Array.from(
  { length: HITS.length - 1 },
  (_, i): [number, number] => [
    BOARD_SIZE - 1 - Math.floor(i / BOARD_SIZE),
    i % BOARD_SIZE,
  ],
);

const shot = (position: [number, number]): BattleshipAction => ({
  type: "fire_shot",
  position,
});

/** The whole game as [actor, action]; actor 0 is player 1 */
export const SCRIPT: [0 | 1, BattleshipAction][] = [
  ...FLEET.map((action): [0, BattleshipAction] => [0, action]),
  ...FLEET.map((action): [1, BattleshipAction] => [1, action]),
  ...HITS.flatMap((hit, i): [0 | 1, BattleshipAction][] =>
    i < MISSES.length
      ? [
          [0, shot(hit)],
          [1, shot(MISSES[i])],
        ]
      : [[0, shot(hit)]],
  ),
];
