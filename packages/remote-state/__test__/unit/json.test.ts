/**
 * Normalizing to JSON drops the keys Immer won't patch, at any depth, and reports
 * which ones it dropped (decision 0047).
 */

import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import { isDeepStrictEqual } from 'node:util';
import { toJson } from '../../src/json.js';

describe('toJson', () => {
  it('drops __proto__ and constructor keys at any depth, and reports them once', () => {
    const onDropped = mock.fn();
    const value = JSON.parse(
      '{"__proto__": {"x": 1}, "a": [{"constructor": 1, "b": 2}], "c": {"__proto__": 3, "prototype": 4}}'
    );
    const result = toJson(value, onDropped);
    assert.equal(JSON.stringify(result), '{"a":[{"b":2}],"c":{"prototype":4}}');
    assert.equal(onDropped.mock.callCount(), 1);
    assert.ok(
      onDropped.mock.calls.some(call =>
        isDeepStrictEqual(call.arguments, [['__proto__', 'constructor']])
      )
    );
  });

  it('reports nothing for values without reserved keys', () => {
    const onDropped = mock.fn();
    assert.deepEqual(toJson({ at: new Date(0), list: [1, undefined] }, onDropped), {
      at: '1970-01-01T00:00:00.000Z',
      list: [1, null],
    });
    assert.equal(onDropped.mock.callCount(), 0);
  });
});
