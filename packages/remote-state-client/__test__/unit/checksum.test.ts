/**
 * The client's checksum is the server's (0059): the same number for any view, as
 * the library's `checksumOf` computes it.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { checksumOf as serverChecksum } from '@malte.muth/remote-state';
import fc from 'fast-check';
import { checksumOf } from '../../src/checksum.js';

describe('checksum', () => {
  it("equals the server's for any JSON value", () => {
    fc.assert(
      fc.property(fc.jsonValue(), value => {
        assert.equal(checksumOf(value), serverChecksum(value));
      }),
      { numRuns: 2000 }
    );
  });
});
