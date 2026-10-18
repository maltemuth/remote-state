/**
 * What the client hands out and receives: snapshots of the player's view, updates
 * from the server, and the connection's state. These mirror the server's events;
 * the client doesn't import the server package, so they're declared here.
 */

import { type Patch } from 'immer';

export type { Patch };

/** The player's whole view at a sequence */
export interface Snapshot<View> {
  sequence: number;
  view: View;
}

/** How the socket sends updates: whole views, or Immer patches */
export type Format = 'state' | 'immer';

/**
 * An update from the server: a whole view, or patches from the view at `sequence - 1`.
 * `reset` marks the whole view sent on every (re)connect, which replaces the view held
 * whatever its sequence: a restarted server may have gone back to an earlier one.
 * `checksum`, sent by a server with the `checksums` option, is checked once the
 * patches are applied (0059).
 */
export type Update<View> =
  | { sequence: number; state: View; reset?: boolean }
  | { sequence: number; patches: Patch[]; checksum?: number };

export type ConnectionState =
  /** Connecting for the first time, or reconnecting */
  | { status: 'connecting'; error?: string }
  | { status: 'connected' }
  /** Lost; reconnects by itself unless the client was closed */
  | { status: 'disconnected'; reason: string }
  /** The server refused the connection, for example for an invalid token; no retries */
  | { status: 'refused'; error: string };
