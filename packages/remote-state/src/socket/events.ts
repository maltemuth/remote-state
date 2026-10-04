/**
 * What the socket sends: a whole view on connect and, depending on the client's
 * `format`, whole views or patches after every transition (decisions 0014, 0031).
 */

import { type Patch } from '../patches/diff.js';

export const formats = ['state', 'immer'] as const;
export type Format = (typeof formats)[number];

/** Event `state`: the player's whole view at `sequence` */
export interface StateEvent<ViewType = unknown> {
  gameId: string;
  sequence: number;
  state: ViewType;
}

/** Event `patches`: turns the player's view at `sequence - 1` into the view at `sequence` */
export interface PatchesEvent {
  gameId: string;
  sequence: number;
  patches: Patch[];
}

export interface ServerToClientEvents {
  state: (event: StateEvent) => void;
  patches: (event: PatchesEvent) => void;
}

export interface SocketData {
  gameId: string;
  playerId: string;
  format: Format;
}
