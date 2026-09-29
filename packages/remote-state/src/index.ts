/**
 * Remote State Library
 * Main entry point for the library
 */

export {
  createRemoteStateServer,
  type RemoteStateServer,
  type RemoteStateServerConfiguration,
} from './core/server';
export {
  type GamePlugin,
  type ActionValidationResult,
  type SocketIOServerConfiguration,
} from './core/types';
export { type GameStateUpdateEvent, type SocketManager } from './core/socket';
export * from './utils/logger';
