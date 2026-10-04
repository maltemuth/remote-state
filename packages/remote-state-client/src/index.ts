/**
 * Remote State client: exchanges an admission code for a session, keeps a player's
 * view of a game in step with the server, and sends the player's actions.
 */

export {
  ActionRejectedError,
  createClient,
  type ClientOptions,
  type RemoteStateClient,
} from './client.js';
export { RequestError } from './http.js';
export { redeemCode, type RedeemOptions, type Session } from './session.js';
export type { ConnectionState, Format, Patch, Snapshot, Update } from './types.js';
