/**
 * The diffs that compute patches between two views, chosen with the `diff` option
 * (decision 0058): the library's own, by default, and rfc6902's, the reference
 * the library's own is tested against. Both produce patches in Immer's format.
 */

import { type Patch } from './patch.js';
import { positionalDiff } from './positionalDiff.js';
import { rfc6902Diff } from './rfc6902Diff.js';

export { type Patch };

/** Patches that turn `base` into `target`, leaving both alone */
export type Diff = (base: unknown, target: unknown) => Patch[];

export const diffs = { positional: positionalDiff, rfc6902: rfc6902Diff } satisfies Record<
  string,
  Diff
>;

export type DiffName = keyof typeof diffs;

/** The default diff */
export const diff: Diff = positionalDiff;
