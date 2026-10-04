/**
 * Patches are Immer's format: array paths with numeric indices, applicable with
 * Immer's `applyPatches`, keeping unchanged parts.
 */

import { describe, expect, it } from '@jest/globals';
import { applyPatches, enablePatches, freeze } from 'immer';
import { diff } from '../../src/patches/diff.js';

enablePatches();

const roundTrip = (base: unknown, target: unknown) => {
  const patches = diff(base, target);
  return { patches, result: applyPatches(freeze(structuredClone(base), true) as object, patches) };
};

describe('diff', () => {
  it('uses numeric indices for arrays and strings for object keys', () => {
    const base = {
      board: [
        [null, null],
        [null, null],
      ],
      '0': 'key',
    };
    const target = {
      board: [
        [null, 'X'],
        [null, null],
      ],
      '0': 'changed',
    };
    const { patches, result } = roundTrip(base, target);
    expect(patches).toContainEqual({ op: 'replace', path: ['board', 0, 1], value: 'X' });
    expect(patches).toContainEqual({ op: 'replace', path: ['0'], value: 'changed' });
    expect(result).toEqual(target);
  });

  it('turns appends into explicit indices', () => {
    const { patches, result } = roundTrip({ log: ['a'] }, { log: ['a', 'b', 'c'] });
    expect(patches.every(patch => typeof patch.path[1] === 'number')).toBe(true);
    expect(result).toEqual({ log: ['a', 'b', 'c'] });
  });

  it('handles removals, nesting and escaped keys', () => {
    const base = { list: [1, 2, 3, 4], 'a/b~c': { deep: [{ x: 1 }] } };
    const target = { list: [1, 4], 'a/b~c': { deep: [{ x: 2 }, { y: 3 }] } };
    expect(roundTrip(base, target).result).toEqual(target);
  });

  it('keeps unchanged parts as the same objects', () => {
    const base = freeze({ changed: { n: 1 }, unchanged: { n: 2 } }, true);
    const result = applyPatches(base, diff(base, { changed: { n: 3 }, unchanged: { n: 2 } }));
    expect(result.unchanged).toBe(base.unchanged);
  });

  it('is empty for equal values and leaves its inputs alone', () => {
    const base = { a: [1, 2] };
    expect(diff(base, { a: [1, 2] })).toEqual([]);
    diff(base, { a: [3] });
    expect(base).toEqual({ a: [1, 2] });
  });
});
