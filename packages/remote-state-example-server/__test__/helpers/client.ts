/**
 * What a browser client does for one game of the example host, over HTTP: create
 * a game through the lobby, join it with a code, send actions and read state.
 */

import type { Express } from "express";
import request from "supertest";

export interface Seat {
  playerId: string;
  token: string;
}

/** A client for the game mounted at `base`, for example `/tic-tac-toe` */
export const clientFor = (app: Express, base: string) => {
  // A new supertest wrapper per request: a shared one reuses one HTTP server that
  // every request starts and stops listening on, which races
  const http = {
    get: (path: string) => request(app).get(path),
    post: (path: string) => request(app).post(path),
  };

  const createGame = async (): Promise<string> =>
    (await http.post(`${base}/lobby/games`).expect(201)).body.gameId;

  const codeFor = async (gameId: string, name: string): Promise<string> =>
    (
      await http
        .post(`${base}/lobby/games/${gameId}/codes`)
        .send({ name })
        .expect(201)
    ).body.code;

  const redeem = (code: string) =>
    http.post(`${base}/api/tokens`).send({ code });

  /** Get a code from the lobby and exchange it for a token */
  const joinAs = async (gameId: string, name: string): Promise<Seat> => {
    const { playerId, token } = (
      await redeem(await codeFor(gameId, name)).expect(201)
    ).body;
    return { playerId, token };
  };

  const act = (gameId: string, token: string, action: object) =>
    http
      .post(`${base}/api/games/${gameId}/actions`)
      .set("Authorization", `Bearer ${token}`)
      .send({ action });

  const stateFor = async <T>(gameId: string, token: string): Promise<T> =>
    (
      await http
        .get(`${base}/api/games/${gameId}/state`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200)
    ).body.state;

  return { createGame, codeFor, redeem, joinAs, act, stateFor };
};
