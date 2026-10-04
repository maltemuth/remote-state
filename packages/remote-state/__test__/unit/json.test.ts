/**
 * Normalizing to JSON drops the keys Immer won't patch, at any depth, and reports
 * which ones it dropped (decision 0047).
 */

import { describe, expect, it, jest } from '@jest/globals';
import { toJson } from '../../src/json.js';

describe('toJson', () => {
  it('drops __proto__ and constructor keys at any depth, and reports them once', () => {
    const onDropped = jest.fn();
    const value = JSON.parse(
      '{"__proto__": {"x": 1}, "a": [{"constructor": 1, "b": 2}], "c": {"__proto__": 3, "prototype": 4}}'
    );
    const result = toJson(value, onDropped);
    expect(JSON.stringify(result)).toBe('{"a":[{"b":2}],"c":{"prototype":4}}');
    expect(onDropped).toHaveBeenCalledTimes(1);
    expect(onDropped).toHaveBeenCalledWith(['__proto__', 'constructor']);
  });

  it('reports nothing for values without reserved keys', () => {
    const onDropped = jest.fn();
    expect(toJson({ at: new Date(0), list: [1, undefined] }, onDropped)).toEqual({
      at: '1970-01-01T00:00:00.000Z',
      list: [1, null],
    });
    expect(onDropped).not.toHaveBeenCalled();
  });
});
