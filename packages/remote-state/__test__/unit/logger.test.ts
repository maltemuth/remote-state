/**
 * The console logger: levels per instance, scopes, metadata and errors.
 */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { consoleLogger, LogLevel } from '../../src/logging/logger.js';

describe('consoleLogger', () => {
  let lines: string[];
  beforeEach(() => {
    lines = [];
    const capture = (...args: unknown[]) => void lines.push(args.join(' '));
    jest.spyOn(console, 'log').mockImplementation(capture);
    jest.spyOn(console, 'error').mockImplementation(capture);
  });
  afterEach(() => jest.restoreAllMocks());

  it('prints info and above by default', () => {
    const logger = consoleLogger();
    logger.debug('hidden');
    logger.info('shown');
    logger.error('also shown');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^\[\S+\] info {2}shown$/);
  });

  it('keeps levels apart per instance', () => {
    consoleLogger({ level: LogLevel.error }).warn('hidden');
    consoleLogger({ level: LogLevel.debug }).debug('shown');
    expect(lines).toEqual([expect.stringContaining('shown')]);
  });

  it('prints the scope, metadata and errors', () => {
    consoleLogger({ scope: 'games' }).warn('slow', { ms: 5, cause: new Error('boom') });
    expect(lines[0]).toContain(
      'warn  games slow | {"ms":5,"cause":{"name":"Error","message":"boom"'
    );
  });
});
