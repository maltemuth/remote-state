/**
 * Diffs two JSON values into Immer's patch format (decisions 0011, 0014): computed
 * with rfc6902, then each path converted to an array with numeric array indices,
 * so clients can apply it with Immer's `applyPatches`.
 */

import { applyPatch, createPatch, type Operation } from 'rfc6902';
import { Pointer } from 'rfc6902/pointer.js';

export interface Patch {
  op: 'add' | 'remove' | 'replace';
  path: (string | number)[];
  value?: unknown;
}

type Container = Record<string, unknown> | unknown[];

/** Resolve pointer tokens against the document: array indices become numbers, `-` the length */
const resolvePath = (document: unknown, tokens: string[]): (string | number)[] => {
  let current = document;
  return tokens.map(token => {
    const key = Array.isArray(current) ? (token === '-' ? current.length : Number(token)) : token;
    current = (current as Container | undefined)?.[key as never];
    return key;
  });
};

/** `createPatch` only emits add, remove and replace */
const toImmer = (operation: Operation, path: (string | number)[]): Patch =>
  operation.op === 'remove'
    ? { op: 'remove', path }
    : {
        op: operation.op as 'add' | 'replace',
        path,
        value: (operation as { value: unknown }).value,
      };

/** Patches that turn `base` into `target`. Neither argument is modified. */
export const diff = (base: unknown, target: unknown): Patch[] => {
  // Apply each operation to a copy, so later paths resolve against the right shape
  const working = { root: structuredClone(base) };
  return createPatch(base, target).map(operation => {
    const tokens = Pointer.fromJSON(operation.path).tokens.slice(1);
    const path = resolvePath(working.root, tokens);
    applyPatch(working, [{ ...operation, path: `/root${operation.path}` }]);
    return toImmer(operation, path);
  });
};
