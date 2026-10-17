/**
 * Views are plain JSON, so diffs see changes in values such as dates that a
 * game's filter may return.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { diff } from '../../src/patches/diff.js';
import { viewFor } from '../../src/plugin/views.js';

describe('viewFor', () => {
  it('normalizes filtered views to JSON', async () => {
    const plugin = {
      validateAction: () => true as const,
      executeAction: (state: unknown) => state,
      filterStateForAudience: (state: { at: number }) => ({ at: new Date(state.at) }),
    };
    const before = await viewFor(plugin, { at: 0 }, 'a');
    const after = await viewFor(plugin, { at: 1000 }, 'a');
    assert.deepEqual(before, { at: '1970-01-01T00:00:00.000Z' });
    assert.deepEqual(diff(before, after), [
      { op: 'replace', path: ['at'], value: '1970-01-01T00:00:01.000Z' },
    ]);
  });
});
