/**
 * Deployment settings, passed when creating a server rather than defined by the
 * game, so the same game can be deployed in different ways.
 */

import { type CorsOptions } from 'cors';
import { type ServerOptions } from 'socket.io';
import { type Logger } from '../logging/logger.js';
import { type DiffName } from '../patches/diff.js';

export interface RemoteStateOptions {
  /** SQLite file to keep games in; `:memory:` (the default) keeps them only while running */
  database?: string;
  /** Where the library logs, including MikroORM's output; `consoleLogger()` by default */
  logger?: Logger;
  /** CORS for the HTTP API and the socket; every origin is allowed by default */
  cors?: CorsOptions;
  /** Socket.IO settings, or `false` for no socket */
  socket?: false | SocketSettings;
  /**
   * How patches between views are computed: `positional`, the library's own diff
   * (the default), or `rfc6902`, the established library it's tested against (0058)
   */
  diff?: DiffName;
  /** Send a checksum of the view with every patch, for clients to check theirs; on by default (0059, 0061) */
  checksums?: boolean;
}

export interface SocketSettings {
  /** Where the socket is served; `/socket.io` by default */
  path?: string;
  /**
   * Socket.IO's parser, for example `socket.io-msgpack-parser` for MessagePack;
   * clients must use the same one. JSON by default (0060).
   */
  parser?: ServerOptions['parser'];
  /** Compress messages with WebSocket's permessage-deflate; off by default (0060) */
  perMessageDeflate?: ServerOptions['perMessageDeflate'];
}

export interface RemoteStateServerOptions extends RemoteStateOptions {
  /** Port to listen on; 0 picks a free one. 3000 by default. */
  port?: number;
}

export const defaultCors: CorsOptions = { origin: '*' };
