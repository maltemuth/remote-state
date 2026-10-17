/**
 * A patch in Immer's format, the only one sent to clients (decision 0014): JSON
 * Patch's operations, with each path as an array and numeric array indices.
 */

export interface Patch {
  op: 'add' | 'remove' | 'replace';
  path: (string | number)[];
  value?: unknown;
}
