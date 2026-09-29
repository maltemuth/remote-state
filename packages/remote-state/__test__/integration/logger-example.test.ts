import { createLogger, LogLevel, setGlobalLogLevel } from '../../src/utils/logger.js';

// Import Jest globals
import { describe, it, beforeEach, afterEach } from '@jest/globals';

const { console } = globalThis;

describe('Logger Example', () => {
  let originalConsoleLog: typeof console.log;
  let originalConsoleError: typeof console.error;
  let logOutput: string[] = [];

  beforeEach(() => {
    // Capture console output
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    logOutput = [];

    console.log = (...args: never[]) => {
      logOutput.push(args.join(' '));
    };

    console.error = (...args: never[]) => {
      logOutput.push(args.join(' '));
    };

    // Reset to default log level
    setGlobalLogLevel(LogLevel.debug);
  });

  afterEach(() => {
    // Restore original console functions
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  it('demonstrates the new logger functionality', () => {
    // Example 1: Setting global log level
    console.log('=== Example 1: Global Log Level ===');
    setGlobalLogLevel(LogLevel.warn);

    const dbLogger = createLogger({ scope: 'database' });
    const apiLogger = createLogger({ scope: 'api' });

    // These won't show because global level is warn
    dbLogger.debug('Database debug message');
    apiLogger.info('API info message');

    // These will show because they're at or above warn level
    dbLogger.warn('Database warning message');
    apiLogger.error('API error message');

    console.log(`Log output count: ${logOutput.length}`);
    console.log('Log outputs:');
    logOutput.forEach((log, index) => {
      console.log(`  ${index + 1}: ${log}`);
    });

    // Example 2: Local log level override
    console.log('\n=== Example 2: Local Log Level Override ===');
    logOutput = []; // Clear previous output

    // Create a logger with local debug level override
    const debugLogger = createLogger({
      scope: 'debug-component',
      logLevel: LogLevel.debug,
    });

    // Even though global level is warn, this will show because of local override
    debugLogger.debug('Debug message with local override');
    debugLogger.info('Info message with local override');

    console.log(`Log output count: ${logOutput.length}`);
    console.log('Log outputs:');
    logOutput.forEach((log, index) => {
      console.log(`  ${index + 1}: ${log}`);
    });

    // Example 3: Simple usage (no explicit log level)
    console.log('\n=== Example 3: Simple Usage ===');
    logOutput = []; // Clear previous output

    // Simple usage with just scope
    const simpleLogger = createLogger({ scope: 'simple' });
    simpleLogger.info('Simple info message');
    simpleLogger.error('Simple error message');

    console.log(`Log output count: ${logOutput.length}`);
    console.log('Log outputs:');
    logOutput.forEach((log, index) => {
      console.log(`  ${index + 1}: ${log}`);
    });
  });
});
