/**
 * Remote State client: exchanges an admission code for a session, keeps a member's
 * view of a space in step with the server, and sends the member's actions.
 */

export {
  ActionRejectedError,
  createClient,
  type ClientOptions,
  type RemoteStateClient,
} from './client.js';
export { RequestError } from './http.js';
export { ChecksumError } from './viewStore.js';
export { redeemCode, type RedeemOptions, type Session } from './session.js';
export type { ConnectionState, Format, Patch, Snapshot, Update } from './types.js';
export { DEFAULT_RESUME_AFTER, type Page } from './resume.js';
