/**
 * Patches are Immer's format: array paths with numeric indices, applicable with
 * Immer's `applyPatches`, keeping unchanged parts. Both diffs are held to that,
 * and the library's own is checked against rfc6902's, the reference, on generated
 * values (0058). The library's own compares arrays by position (0057).
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isDeepStrictEqual } from 'node:util';
import fc from 'fast-check';
import { applyPatches, enablePatches, freeze } from 'immer';
import { type Diff, diffs } from '../../src/patches/diff.js';

enablePatches();

const apply = (base: unknown, patches: ReturnType<Diff>) =>
  applyPatches(freeze(structuredClone(base), true) as object, patches);

/** JSON as views are: without reserved keys (0047), and with -0 as JSON sends it */
const asJson = (arbitrary: fc.Arbitrary<unknown>) =>
  arbitrary
    .map(value => JSON.stringify(value))
    .filter(text => !/"(__proto__|constructor)":/.test(text))
    .map(text => JSON.parse(text) as unknown);

/** Small keys and values, so that two generated values often share their shape */
const similar = asJson(
  fc.letrec(tie => ({
    value: fc.oneof(
      { depthSize: 'small', withCrossShrink: true },
      fc.constantFrom(0, 1, 2, 'x', 'y', null, true),
      fc.array(tie('value'), { maxLength: 5 }),
      fc.dictionary(fc.constantFrom('a', 'b', 'c', '0', 'a/b', '~1'), tie('value'), {
        maxKeys: 4,
      })
    ),
  })).value
);

for (const [name, diff] of Object.entries(diffs) as [string, Diff][]) {
  const roundTrip = (base: unknown, target: unknown) => {
    const patches = diff(base, target);
    return { patches, result: apply(base, patches) };
  };

  describe(`${name} diff`, () => {
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

    it('replaces a value whose type changes', () => {
      assert.deepEqual(roundTrip({ a: { b: 1 } }, { a: [1, 2] }).result, { a: [1, 2] });
    });

    it('turns any JSON value into any other', () => {
      const json = asJson(fc.jsonValue());
      fc.assert(
        fc.property(json, json, (base, target) => {
          assert.deepEqual(roundTrip({ root: base }, { root: target }).result, { root: target });
        }),
        { numRuns: 1000 }
      );
      fc.assert(
        fc.property(similar, similar, (base, target) => {
          assert.deepEqual(roundTrip({ root: base }, { root: target }).result, { root: target });
        }),
        { numRuns: 2000 }
      );
    });

    it('is empty for equal values and leaves its inputs alone', () => {
      const base = { a: [1, 2] };
      assert.deepEqual(diff(base, { a: [1, 2] }), []);
      diff(base, { a: [3] });
      assert.deepEqual(base, { a: [1, 2] });
    });
  });
}

describe('positional diff, against rfc6902', () => {
  const { positional, rfc6902 } = diffs;

  it('leads to the same value as rfc6902 for any two similar values', () => {
    fc.assert(
      fc.property(similar, similar, (base, target) => {
        const ours = apply({ root: base }, positional({ root: base }, { root: target }));
        const reference = apply({ root: base }, rfc6902({ root: base }, { root: target }));
        assert.deepEqual(ours, reference);
        assert.deepEqual(ours, { root: target });
      }),
      { numRuns: 5000 }
    );
  });

  it('is empty exactly when rfc6902 is', () => {
    fc.assert(
      fc.property(similar, similar, (base, target) => {
        assert.equal(positional(base, target).length === 0, rfc6902(base, target).length === 0);
      }),
      { numRuns: 2000 }
    );
  });

  it('describes a move on a board as the two squares that changed', () => {
    const row = () => Array<string | null>(8).fill(null);
    const base = { board: [row(), row(), ['K', ...row().slice(1)]] };
    const target = { board: [row(), ['K', ...row().slice(1)], row()] };
    assert.deepEqual(positional(base, target), [
      { op: 'replace', path: ['board', 1, 0], value: 'K' },
      { op: 'replace', path: ['board', 2, 0], value: null },
    ]);
  });

  it('replaces the whole value when its type changes at the root', () => {
    assert.deepEqual(positional({ a: 1 }, [1]), [{ op: 'replace', path: [], value: [1] }]);
  });

  it('treats keys holding undefined as absent, as JSON does', () => {
    assert.deepEqual(positional({ a: 1, b: undefined }, { a: 1, c: undefined }), []);
    assert.deepEqual(positional({ a: 1 }, { a: undefined }), [{ op: 'remove', path: ['a'] }]);
  });
});
