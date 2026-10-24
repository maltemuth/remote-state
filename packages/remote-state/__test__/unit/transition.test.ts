/**
 * A transition's changes default per field, also when a space passes a field as
 * undefined.
 */

import assert from 'node:assert/strict';
import { it } from 'node:test';
import { transition, unwrapTransition } from '../../src/plugin/transition.js';

it('defaults missing and undefined changes', () => {
  assert.deepEqual(unwrapTransition(transition(1, { schedule: undefined, cancel: undefined })), {
    state: 1,
    changes: { audiences: {}, schedule: [], cancel: [] },
  });
});
