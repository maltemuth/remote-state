/**
 * Plays one complete battleship game between two simulated players: both place
 * their fleets, then player 1 sinks player 2's fleet while player 2 misses. Every
 * action is timed until its HTTP response, and until the other player's socket
 * receives the update.
 */

import { SCRIPT } from "../games/battleship/script.js";
import type { Format } from "@malte.muth/remote-state";
import { joinPlayer, type Parser, type Player, postJson } from "./player.js";

export interface Samples {
  /** Milliseconds from sending an action to its HTTP response */
  http: number[];
  /** Milliseconds from sending an action to the other player receiving the update */
  endToEnd: number[];
  errors: number;
  /** Bytes the players' sockets received */
  bytes: number;
}

export interface GameOptions {
  base: string;
  format: Format;
  parser: Parser;
  /** Average milliseconds a player thinks before each action */
  pause: number;
}

export const ACTIONS_PER_GAME = SCRIPT.length;

export const playGame = async (
  { base, format, parser, pause }: GameOptions,
  samples: Samples,
) => {
  const { gameId } = (await postJson(`${base}/battleship/lobby/games`))
    .body as {
    gameId: string;
  };
  const players: Player[] = [
    await joinPlayer(base, gameId, "A", format, parser),
    await joinPlayer(base, gameId, "B", format, parser),
  ];
  for (const [actor, action] of SCRIPT) {
    if (pause)
      await new Promise((r) => setTimeout(r, pause * (0.5 + Math.random())));
    const started = performance.now();
    const { status, body } = await postJson(
      `${base}/battleship/api/spaces/${gameId}/actions`,
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
  for (const player of players) {
    // A view that missed its checksum counts as an error
    samples.errors += player.mismatches();
    samples.bytes += player.bytesReceived();
    player.disconnect();
  }
};
