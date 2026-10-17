/**
 * Patches are Immer's format: array paths with numeric indices, applicable with
 * Immer's `applyPatches`, keeping unchanged parts.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isDeepStrictEqual } from 'node:util';
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
    assert.ok(
      patches.some(item =>
        isDeepStrictEqual(item, { op: 'replace', path: ['board', 0, 1], value: 'X' })
      )
    );
    assert.ok(
      patches.some(item =>
        isDeepStrictEqual(item, { op: 'replace', path: ['0'], value: 'changed' })
      )
    );
    assert.deepEqual(result, target);
  });

  it('turns appends into explicit indices', () => {
    const { patches, result } = roundTrip({ log: ['a'] }, { log: ['a', 'b', 'c'] });
    assert.equal(
      patches.every(patch => typeof patch.path[1] === 'number'),
      true
    );
    assert.deepEqual(result, { log: ['a', 'b', 'c'] });
  });

  it('handles removals, nesting and escaped keys', () => {
    const base = { list: [1, 2, 3, 4], 'a/b~c': { deep: [{ x: 1 }] } };
    const target = { list: [1, 4], 'a/b~c': { deep: [{ x: 2 }, { y: 3 }] } };
    assert.deepEqual(roundTrip(base, target).result, target);
  });

  it('keeps unchanged parts as the same objects', () => {
    const base = freeze({ changed: { n: 1 }, unchanged: { n: 2 } }, true);
    const result = applyPatches(base, diff(base, { changed: { n: 3 }, unchanged: { n: 2 } }));
    assert.equal(result.unchanged, base.unchanged);
  });

  it('is empty for equal values and leaves its inputs alone', () => {
    const base = { a: [1, 2] };
    assert.deepEqual(diff(base, { a: [1, 2] }), []);
    diff(base, { a: [3] });
    assert.deepEqual(base, { a: [1, 2] });
  });
});
