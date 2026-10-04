/**
 * A transition's changes default per field, also when a game passes a field as
 * undefined.
 */

import { expect, it } from '@jest/globals';
import { transition, unwrapTransition } from '../../src/plugin/transition.js';

it('defaults missing and undefined changes', () => {
  expect(unwrapTransition(transition(1, { schedule: undefined, cancel: undefined }))).toEqual({
    state: 1,
    changes: { audiences: {}, schedule: [], cancel: [] },
  });
});
