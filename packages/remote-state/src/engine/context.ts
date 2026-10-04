/**
 * What the engine's operations share: the database, the game, the per-game lock,
 * the logger, and where finished transitions are published (the socket, if any).
 */

import { type Orm } from '../database/orm.js';
import { type Logger } from '../logging/logger.js';
import { type Patch } from '../patches/diff.js';
import { type AnyGamePlugin } from '../plugin/types.js';
import { type GameLock } from './gameLock.js';

/** One audience's view after a transition, and the patches leading to it */
export interface AudienceUpdate {
  view: unknown;
  patches: Patch[];
}

/** Everything needed to send a recorded transition to connected clients */
export interface TransitionOutcome {
  gameId: string;
  sequence: number;
  previousState: unknown;
  updates: Map<string, AudienceUpdate>;
  /** Player ID → effective audience, before and after the transition */
  audiencesBefore: Map<string, string>;
  audiencesAfter: Map<string, string>;
}

export interface Publisher {
  publish: (outcome: TransitionOutcome) => Promise<void>;
}

export interface EngineContext {
  orm: Orm;
  plugin: AnyGamePlugin;
  withGameLock: GameLock;
  logger: Logger;
  publisher: Publisher;
}
