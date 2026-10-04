/**
 * Deployment settings a game currently carries in `serverConfiguration`: logging,
 * database and Socket.IO.
 */

import { type LogLevel } from '../utils/logger.js';

export interface SocketIOServerConfiguration {
  enabled?: boolean;
  cors?: {
    origin: string | string[];
    methods: string[];
  };
}

export interface RemoteStateServerConfiguration {
  minimumLogLevel?: LogLevel;
  /** Persist to `databaseFilename` (default `games.db`) instead of an in-memory database */
  persistDatabase?: boolean;
  databaseFilename?: string;
  socketIO?: SocketIOServerConfiguration;
}
