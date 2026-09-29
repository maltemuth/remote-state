/**
 * Logger utility for the remote-state server
 * Provides structured logging with different log levels
 */

export enum LogLevel {
  debug = 0,
  info = 1,
  warn = 2,
  error = 3,
}

const { console } = globalThis;

// Global log level that all loggers inherit by default
let globalLogLevel: LogLevel = LogLevel.debug;

/**
 * Set the global log level for all loggers
 * @param level The minimum log level to display
 */
export const setGlobalLogLevel = (level: LogLevel): void => {
  globalLogLevel = level;
};

/**
 * Get the current global log level
 */
export const getGlobalLogLevel = (): LogLevel => {
  return globalLogLevel;
};

interface LogEntry {
  scope?: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  meta?: unknown;
}

type LoggerFunction = (message: string, meta?: unknown) => void;

export interface Logger {
  info: LoggerFunction;
  debug: LoggerFunction;
  warn: LoggerFunction;
  error: LoggerFunction;
}

interface LoggerOptions {
  scope?: string;
  logLevel?: LogLevel;
}

// Errors have no enumerable properties, so JSON.stringify would render them as {}
const serializeErrors = (_key: string, value: unknown) =>
  value instanceof Error ? { name: value.name, message: value.message, stack: value.stack } : value;

const formatLogEntry = (entry: LogEntry) => {
  const scopeName = entry.scope || '';
  const levelName = LogLevel[entry.level].padEnd(5);
  const timestamp = `[${new Date(entry.timestamp).toISOString()}]`;
  const metaStr =
    entry.meta !== undefined ? `| ${JSON.stringify(entry.meta, serializeErrors)}` : '';
  return [timestamp, levelName, scopeName, entry.message, metaStr].join(' ');
};

const createLevelLogger = (level: LogLevel, options?: LoggerOptions): LoggerFunction => {
  return (message: string, meta?: unknown) => {
    // Resolved per call, so loggers created at import time follow later setGlobalLogLevel calls
    const minimumLevel = options?.logLevel ?? globalLogLevel;
    if (level < minimumLevel) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      meta,
    };
    if (options?.scope !== undefined) {
      entry.scope = options.scope;
    }

    const formattedMessage = formatLogEntry(entry);

    if (level === LogLevel.error) {
      console.error(formattedMessage);
    } else {
      console.log(formattedMessage);
    }
  };
};

/**
 * Create a logger. Without an explicit `logLevel`, it follows the global log level.
 */
export const createLogger = (options?: LoggerOptions): Logger => ({
  debug: createLevelLogger(LogLevel.debug, options),
  info: createLevelLogger(LogLevel.info, options),
  warn: createLevelLogger(LogLevel.warn, options),
  error: createLevelLogger(LogLevel.error, options),
});

// Create a default logger instance
const { debug, info, warn, error } = createLogger();

export { debug, info, warn, error };
