/**
 * What a browser client does, over HTTP: create a game through the example's
 * lobby, join it with a code, send actions and read state.
 */

import type { Express } from "express";
import request from "supertest";

export interface Seat {
  playerId: string;
  token: string;
}

export const createGame = async (app: Express): Promise<string> =>
  (await request(app).post("/lobby/games").expect(201)).body.gameId;

/** Get a code from the lobby and exchange it for a token */
export const joinAs = async (
  app: Express,
  gameId: string,
  name: string,
): Promise<Seat> => {
  const { code } = (
    await request(app)
      .post(`/lobby/games/${gameId}/codes`)
      .send({ name })
      .expect(201)
  ).body;
  const { playerId, token } = (
    await request(app).post("/api/tokens").send({ code }).expect(201)
  ).body;
  return { playerId, token };
};

export const act = (
  app: Express,
  gameId: string,
  token: string,
  action: object,
) =>
  request(app)
    .post(`/api/games/${gameId}/actions`)
    .set("Authorization", `Bearer ${token}`)
    .send({ action });

export const stateFor = async <T>(
  app: Express,
  gameId: string,
  token: string,
): Promise<T> =>
  (
    await request(app)
      .get(`/api/games/${gameId}/state`)
      .set("Authorization", `Bearer ${token}`)
      .expect(200)
  ).body.state;
