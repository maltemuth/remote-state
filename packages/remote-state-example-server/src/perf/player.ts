/**
 * A simulated player for performance runs: joins through the example's lobby,
 * listens on the socket, and reports when an update with a given sequence
 * arrived, so latency can be measured up to the moment another player sees it. It
 * keeps its view as a client does, applying patches and checking their checksums,
 * and counts the bytes its socket received.
 */

import { setTimeout as sleep } from "timers/promises";
import { io, type Socket } from "socket.io-client";
import { applyPatches, enablePatches, type Patch } from "immer";
import msgpackParser from "socket.io-msgpack-parser";
import { checksumOf, type Format } from "@malte.muth/remote-state";
import { redeemCode } from "@malte.muth/remote-state-client";

enablePatches();

export type Parser = "json" | "msgpack";

export interface Player {
  token: string;
  /** Resolves with the time the update with this sequence arrived on the socket */
  arrival: (sequence: number) => Promise<number>;
  disconnect: () => void;
  /** Updates whose patches didn't lead to their checksum */
  mismatches: () => number;
  /** Bytes the socket received so far, on the wire */
  bytesReceived: () => number;
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
  parser: Parser = "json",
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
    ...(parser === "msgpack" ? { parser: msgpackParser } : {}),
  });
  const received = ({ sequence }: { sequence: number }) => {
    const time = performance.now();
    arrivals.set(sequence, time);
    waiting.get(sequence)?.(time);
  };
  let view: unknown = null;
  let mismatches = 0;
  socket.on("state", (event: { sequence: number; state: unknown }) => {
    view = event.state;
    received(event);
  });
  socket.on(
    "patches",
    (event: { sequence: number; patches: Patch[]; checksum?: number }) => {
      view = applyPatches(view as object, event.patches);
      if (event.checksum !== undefined && checksumOf(view) !== event.checksum)
        mismatches++;
      received(event);
    },
  );
  // The TCP socket under the WebSocket, from the `ws` client in Node.js
  const tcp = () =>
    (
      socket.io.engine.transport as unknown as {
        ws?: { _socket?: { bytesRead: number } };
      }
    ).ws?._socket;
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
    mismatches: () => mismatches,
    bytesReceived: () => tcp()?.bytesRead ?? 0,
  };
};
