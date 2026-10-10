/**
 * A player's credentials for one game, and getting them: the host hands the
 * client an admission code, which is exchanged once for a token.
 */

import { resolveEndpoints } from './endpoints.js';
import { requestJson } from './http.js';

export interface Session {
  gameId: string;
  playerId: string;
  /** The player's credential; keep it, since the server can't hand it out again */
  token: string;
}

export interface RedeemOptions {
  /** Where the game's library routes are mounted; the page's origin by default */
  baseUrl?: string;
}

/**
 * Exchange an admission code for a session. Throws a `RequestError` with status 401
 * for a used or expired code, and 403 with the game's reason if it refuses the player.
 */
export const redeemCode = (code: string, options: RedeemOptions = {}): Promise<Session> =>
  requestJson<Session>(resolveEndpoints(options.baseUrl).api('/tokens'), {
    method: 'POST',
    body: { code },
  });
