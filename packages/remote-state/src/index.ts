/**
 * Public entry point of the Remote State library: the server and its embeddable
 * core, the game plugin contract, logging, and the shapes of what clients receive.
 */

export { createRemoteStateServer, type RemoteStateServer } from './server/createServer.js';
export { createRemoteState, type RemoteState } from './server/createRemoteState.js';
export { type RemoteStateOptions, type RemoteStateServerOptions } from './server/options.js';
export { UnknownGameError } from './server/errors.js';
export { UnsupportedDatabaseError } from './database/orm.js';
export { CODE_LIFETIME_MS, type Admission, type Identity } from './server/host.js';
export {
  type ActionValidationResult,
  type Awaitable,
  type GamePlugin,
  type JoiningPlayer,
  type StateResult,
} from './plugin/types.js';
export {
  transition,
  withAudiences,
  type AudienceChanges,
  type TimerRequest,
  type Transition,
  type TransitionChanges,
} from './plugin/transition.js';
export { SYSTEM } from './plugin/system.js';
export { type ActResult } from './engine/act.js';
export { GameRefusal } from './plugin/refusal.js';
export { EVERYONE } from './plugin/views.js';
export { type DiffName, type Patch } from './patches/diff.js';
export { type Format, type PatchesEvent, type StateEvent } from './socket/events.js';
export {
  consoleLogger,
  LogLevel,
  silentLogger,
  type ConsoleLoggerOptions,
  type LogFunction,
  type Logger,
} from './logging/logger.js';
