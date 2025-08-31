import {
  createLogger,
  LogLevel,
  setGlobalLogLevel,
  getGlobalLogLevel,
} from '../../src/utils/logger';

// Import Jest globals
import { describe, beforeEach, afterEach, it, expect } from '@jest/globals';

// Access console from globalThis
const { console } = globalThis;

describe('Logger', () => {
  let originalConsoleLog: typeof console.log;
  let originalConsoleError: typeof console.error;
  let logOutput: string[] = [];

  beforeEach(() => {
    // Capture console output
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    logOutput = [];

    console.log = (...args: any[]) => {
      logOutput.push(args.join(' '));
    };

    console.error = (...args: any[]) => {
      logOutput.push(args.join(' '));
    };
  });

  afterEach(() => {
    // Restore original console functions
    console.log = originalConsoleLog;
    console.error = originalConsoleError;

    // Reset to default log level
    setGlobalLogLevel(LogLevel.debug);
  });

  describe('Global Log Level', () => {
    it('should respect global log level setting', () => {
      // Set global log level to warn
      setGlobalLogLevel(LogLevel.warn);

      const logger = createLogger({ scope: 'test' });

      // These should not produce output because global level is warn
      logger.debug('Debug message');
      logger.info('Info message');

      // These should produce output
      logger.warn('Warning message');
      logger.error('Error message');

      expect(logOutput.length).toBe(2);
      expect(logOutput[0]).toContain('warn');
      expect(logOutput[0]).toContain('Warning message');
      expect(logOutput[1]).toContain('error');
      expect(logOutput[1]).toContain('Error message');
    });

    it('should allow local override of log level', () => {
      // Set global log level to error
      setGlobalLogLevel(LogLevel.error);

      // Create logger with local debug level override
      const logger = createLogger({ scope: 'test', logLevel: LogLevel.debug });

      // All messages should produce output because of local override
      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warning message');
      logger.error('Error message');

      expect(logOutput.length).toBe(4);
    });

    it('should get current global log level', () => {
      setGlobalLogLevel(LogLevel.warn);
      expect(getGlobalLogLevel()).toBe(LogLevel.warn);

      setGlobalLogLevel(LogLevel.error);
      expect(getGlobalLogLevel()).toBe(LogLevel.error);
    });
  });
});
