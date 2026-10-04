/**
 * Logging without global state: a `Logger` interface a host can implement with its
 * own logger, and a console implementation with a level per instance.
 */

export enum LogLevel {
  debug = 0,
  info = 1,
  warn = 2,
  error = 3,
}

export type LogFunction = (message: string, meta?: unknown) => void;

export interface Logger {
  debug: LogFunction;
  info: LogFunction;
  warn: LogFunction;
  error: LogFunction;
}

export interface ConsoleLoggerOptions {
  /** The lowest level that's printed; `info` by default */
  level?: LogLevel;
  /** Printed with every message, for example the server's name */
  scope?: string;
}

// Errors have no enumerable properties, so JSON.stringify would render them as {}
const serializeErrors = (_key: string, value: unknown) =>
  value instanceof Error ? { name: value.name, message: value.message, stack: value.stack } : value;

const format = (level: LogLevel, scope: string | undefined, message: string, meta: unknown) =>
  [
    `[${new Date().toISOString()}]`,
    LogLevel[level].padEnd(5),
    ...(scope ? [scope] : []),
    message,
    ...(meta === undefined ? [] : [`| ${JSON.stringify(meta, serializeErrors)}`]),
  ].join(' ');

/** Logs to the console: errors to `console.error`, everything else to `console.log` */
export const consoleLogger = ({ level = LogLevel.info, scope }: ConsoleLoggerOptions = {}) => {
  const at =
    (messageLevel: LogLevel): LogFunction =>
    (message, meta) => {
      if (messageLevel < level) return;
      const line = format(messageLevel, scope, message, meta);
      // The console is this logger's purpose
      // eslint-disable-next-line no-console
      if (messageLevel === LogLevel.error) console.error(line);
      // eslint-disable-next-line no-console
      else console.log(line);
    };
  return {
    debug: at(LogLevel.debug),
    info: at(LogLevel.info),
    warn: at(LogLevel.warn),
    error: at(LogLevel.error),
  } satisfies Logger;
};

/** Discards everything, for example in tests */
export const silentLogger: Logger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};
