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

interface StrictLoggerOptions {
  scope?: string;
  logLevel: LogLevel;
}

type LoggerOptions = Partial<StrictLoggerOptions>;

const NOOP = () => {};

const formatLogEntry = (entry: LogEntry) => {
  const scopeName = entry.scope || '';
  const levelName = LogLevel[entry.level].padEnd(5);
  const timestamp = `[${new Date(entry.timestamp).toISOString()}]`;
  const metaStr = entry.meta ? `| ${JSON.stringify(entry.meta)}` : '';
  return [timestamp, levelName, scopeName, entry.message, metaStr].join(' ');
};

const createLoggerFunction = (options: StrictLoggerOptions): LoggerFunction => {
  const level = options.logLevel;
  return (message: string, meta?: unknown) => {
    const entry: LogEntry = {
      scope: options.scope,
      timestamp: new Date().toISOString(),
      level,
      message,
      meta,
    };

    const formattedMessage = formatLogEntry(entry);

    if (level === LogLevel.error) {
      console.error(formattedMessage);
    } else {
      console.log(formattedMessage);
    }
  };
};

const createLevelLogger = (level: LogLevel, options: StrictLoggerOptions): LoggerFunction => {
  if (options.logLevel > level) {
    return NOOP;
  }
  return createLoggerFunction({ ...options, logLevel: level });
};

export const createLogger = (options?: LoggerOptions): Logger => {
  const optionsWithDefaults: StrictLoggerOptions = {
    logLevel: LogLevel.debug,
    ...options,
  };
  return {
    debug: createLevelLogger(LogLevel.debug, optionsWithDefaults),
    info: createLevelLogger(LogLevel.info, optionsWithDefaults),
    warn: createLevelLogger(LogLevel.warn, optionsWithDefaults),
    error: createLevelLogger(LogLevel.error, optionsWithDefaults),
  };
};

// Create a default logger instance
const { debug, info, warn, error } = createLogger();

export { debug, info, warn, error };
