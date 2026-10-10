/**
 * A simulated player for performance runs: joins through the example's lobby,
 * listens on the socket, and reports when an update with a given sequence
 * arrived, so latency can be measured up to the moment another player sees it.
 */

import { setTimeout as sleep } from "timers/promises";
import { io, type Socket } from "socket.io-client";
import type { Format } from "@malte.muth/remote-state";
import { redeemCode } from "@malte.muth/remote-state-client";

export interface Player {
  token: string;
  /** Resolves with the time the update with this sequence arrived on the socket */
  arrival: (sequence: number) => Promise<number>;
  disconnect: () => void;
}

/** Long enough for any update under load; a lost one fails the run instead of hanging it */
const WAIT_MS = 30_000;
const within = <T>(promise: Promise<T>, what: string): Promise<T> =>
  Promise.race([
    promise,
    sleep(WAIT_MS, undefined, { ref: false }).then(() => {
      throw new Error(`No ${what} within ${WAIT_MS} ms`);
    }),
  ]);

export const postJson = async (
  url: string,
  body: object = {},
  token?: string,
): Promise<{ status: number; body: Record<string, unknown> }> => {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return {
    status: response.status,
    body: (await response.json()) as Record<string, unknown>,
  };
};

export const joinPlayer = async (
  base: string,
  gameId: string,
  name: string,
  format: Format,
): Promise<Player> => {
  const { code } = (
    await postJson(`${base}/battleship/lobby/games/${gameId}/codes`, { name })
  ).body as { code: string };
  const { token } = await redeemCode(code, { baseUrl: `${base}/battleship` });

  const arrivals = new Map<number, number>();
  const waiting = new Map<number, (time: number) => void>();
  const socket: Socket = io(base, {
    path: "/battleship/socket.io",
    auth: { gameId, token },
    query: { format },
    transports: ["websocket"],
  });
  const received = ({ sequence }: { sequence: number }) => {
    const time = performance.now();
    arrivals.set(sequence, time);
    waiting.get(sequence)?.(time);
  };
  socket.on("state", received);
  socket.on("patches", received);
  await within(
    new Promise((resolve) => socket.once("state", resolve)),
    "first view",
  );

  return {
    token,
    arrival: (sequence) =>
      arrivals.has(sequence)
        ? Promise.resolve(arrivals.get(sequence)!)
        : within(
            new Promise((resolve) => waiting.set(sequence, resolve)),
            `update ${sequence}`,
          ),
    disconnect: () => socket.disconnect(),
  };
};
