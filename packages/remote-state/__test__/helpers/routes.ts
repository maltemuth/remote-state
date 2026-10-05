/**
 * The routes a player's view can come from, for property tests: the views a
 * player's socket events add up to, and what `GET …/state` and `GET …/updates`
 * answer. HTTP answers are added to the player's recorded payloads.
 */

import { applyPatches, enablePatches } from 'immer';
import request from 'supertest';
import { type ModelServer, type PlayedPlayer } from './scenario.js';
import { serverUrl } from './testServer.js';

enablePatches();

/** Sequence → the view after the socket events up to it; throws if they're out of order */
export const socketViews = (player: PlayedPlayer): Map<number, unknown> => {
  const views = new Map<number, unknown>();
  let view: unknown;
  let sequence: number | null = null;
  for (const { event, payload } of player.events) {
    if (event === 'state') {
      view = payload.state;
    } else {
      if (sequence === null || payload.sequence !== sequence + 1) {
        throw new Error(`Patches for ${payload.sequence} arrived after ${sequence}`);
      }
      view = applyPatches(view as object, payload.patches);
    }
    sequence = payload.sequence;
    views.set(sequence, view);
  }
  return views;
};

const get = async (server: ModelServer, path: string, player: PlayedPlayer) => {
  const response = await request(serverUrl(server))
    .get(path)
    .set('Authorization', `Bearer ${player.token}`)
    .redirects(0);
  player.payloads.push(response.text);
  return response;
};

export const getState = async (server: ModelServer, gameId: string, player: PlayedPlayer) =>
  (await get(server, `/api/games/${gameId}/state`, player)).body as {
    sequence: number;
    state: unknown;
  };

export const getUpdates = (
  server: ModelServer,
  gameId: string,
  player: PlayedPlayer,
  since: number
) => get(server, `/api/games/${gameId}/updates?since=${since}`, player);
