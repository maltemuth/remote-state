/**
 * The checksum of a view (0059): independent of key order, as JSON sends values,
 * and different for different views.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fc from 'fast-check';
import { canonicalJson, checksumOf } from '../../src/patches/checksum.js';

describe('checksum', () => {
  it('writes canonical JSON: sorted keys, undefined dropped, toJSON applied', () => {
    assert.equal(
      canonicalJson({ b: [1, undefined, { d: 1, c: null }], a: 'x', u: undefined }),
      '{"a":"x","b":[1,null,{"c":null,"d":1}]}'
    );
    assert.equal(canonicalJson({ at: new Date(0) }), '{"at":"1970-01-01T00:00:00.000Z"}');
  });

  it('is the same for any key order, and for a value sent as JSON', () => {
    fc.assert(
      fc.property(fc.jsonValue(), value => {
        const reordered = JSON.parse(JSON.stringify(value), (_key, item: unknown) =>
          item && typeof item === 'object' && !Array.isArray(item)
            ? Object.fromEntries(Object.entries(item).reverse())
            : item
        ) as unknown;
        assert.equal(checksumOf(reordered), checksumOf(JSON.parse(JSON.stringify(value))));
        assert.equal(canonicalJson(reordered), canonicalJson(JSON.parse(JSON.stringify(value))));
      }),
      { numRuns: 1000 }
    );
  });

  it('is a safe integer, different for different views', () => {
    const sums = new Set(Array.from({ length: 10_000 }, (_, n) => checksumOf({ n })));
    assert.equal(sums.size, 10_000);
    assert.ok([...sums].every(sum => Number.isSafeInteger(sum) && sum >= 0));
  });
});
