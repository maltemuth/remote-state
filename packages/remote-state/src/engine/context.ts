/**
 * What the engine's operations share: the database, the space, the per-space lock,
 * the logger, and where finished transitions are published (the socket, if any).
 */

import { type Orm } from '../database/orm.js';
import { type Logger } from '../logging/logger.js';
import { type Diff } from '../patches/diff.js';
import { type AnyRules } from '../plugin/types.js';
import { type TimerRequest } from '../plugin/transition.js';
import { type SpaceLock } from './spaceLock.js';
import { type Scheduler } from './scheduler.js';

/**
 * Everything needed to send a recorded transition to connected clients. Views and
 * patches are computed from the two states when they're sent (0056).
 */
export interface TransitionOutcome {
  spaceId: string;
  sequence: number;
  previousState: unknown;
  state: unknown;
  /** Member ID → effective audience, before and after the transition */
  audiencesBefore: Map<string, string>;
  audiencesAfter: Map<string, string>;
  /** What the transition scheduled and cancelled, to apply once it's recorded */
  timers: { schedule: TimerRequest[]; cancel: string[] };
}

export interface Publisher {
  publish: (outcome: TransitionOutcome) => Promise<void>;
}

export interface EngineContext {
  orm: Orm;
  plugin: AnyRules;
  withSpaceLock: SpaceLock;
  logger: Logger;
  publisher: Publisher;
  scheduler: Scheduler;
  /** Computes patches between two views */
  diff: Diff;
  /** Whether patches carry a checksum of the view they lead to (0059) */
  checksums: boolean;
}
