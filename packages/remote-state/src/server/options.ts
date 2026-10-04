/**
 * Deployment settings, passed when creating a server rather than defined by the
 * game, so the same game can be deployed in different ways.
 */

import { type CorsOptions } from 'cors';
import { type Logger } from '../logging/logger.js';

export interface RemoteStateOptions {
  /** SQLite file to keep games in; `:memory:` (the default) keeps them only while running */
  database?: string;
  /** Where the library logs, including MikroORM's output; `consoleLogger()` by default */
  logger?: Logger;
  /** CORS for the HTTP API and the socket; every origin is allowed by default */
  cors?: CorsOptions;
  /** Socket.IO settings, or `false` for no socket */
  socket?: false | { path?: string };
}

export interface RemoteStateServerOptions extends RemoteStateOptions {
  /** Port to listen on; 0 picks a free one. 3000 by default. */
  port?: number;
}

export const defaultCors: CorsOptions = { origin: '*' };
