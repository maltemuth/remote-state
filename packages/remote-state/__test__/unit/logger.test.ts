/**
 * The console logger: levels per instance, scopes, metadata and errors.
 */

import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import { consoleLogger, LogLevel } from '../../src/logging/logger.js';

describe('consoleLogger', () => {
  let lines: string[];
  beforeEach(() => {
    lines = [];
    const capture = (...args: unknown[]) => void lines.push(args.join(' '));
    mock.method(console, 'log', capture);
    mock.method(console, 'error', capture);
  });
  afterEach(() => mock.restoreAll());

  it('prints info and above by default', () => {
    const logger = consoleLogger();
    logger.debug('hidden');
    logger.info('shown');
    logger.error('also shown');
    assert.equal(lines.length, 2);
    assert.match(lines[0], /^\[\S+\] info {2}shown$/);
  });

  it('keeps levels apart per instance', () => {
    consoleLogger({ level: LogLevel.error }).warn('hidden');
    consoleLogger({ level: LogLevel.debug }).debug('shown');
    assert.equal(lines.length, 1);
    assert.match(lines[0], /shown/);
  });

  it('prints the scope, metadata and errors', () => {
    consoleLogger({ scope: 'spaces' }).warn('slow', { ms: 5, cause: new Error('boom') });
    assert.ok(
      lines[0].includes('warn  spaces slow | {"ms":5,"cause":{"name":"Error","message":"boom"')
    );
  });
});
