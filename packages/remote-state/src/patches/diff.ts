/**
 * Diffs two JSON values into Immer's patch format (decisions 0011, 0014, 0057), so
 * clients can apply it with Immer's `applyPatches`. Paths are arrays, with numeric
 * array indices. Arrays are compared position by position, then grown or shrunk at
 * the end; parts that are the same object in both values are skipped.
 */

export interface Patch {
  op: 'add' | 'remove' | 'replace';
  path: (string | number)[];
  value?: unknown;
}

type Path = (string | number)[];
type JsonObject = Record<string, unknown>;

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A key holding `undefined` isn't in JSON, so it doesn't count as present */
const has = (object: JsonObject, key: string) =>
  Object.hasOwn(object, key) && object[key] !== undefined;

const diffArrays = (base: unknown[], target: unknown[], path: Path, patches: Patch[]) => {
  const shared = Math.min(base.length, target.length);
  for (let index = 0; index < shared; index++) {
    diffValues(base[index], target[index], [...path, index], patches);
  }
  for (let index = shared; index < target.length; index++) {
    patches.push({ op: 'add', path: [...path, index], value: target[index] });
  }
  // From the end, so each index is still the last one when it's removed
  for (let index = base.length - 1; index >= shared; index--) {
    patches.push({ op: 'remove', path: [...path, index] });
  }
};

const diffObjects = (base: JsonObject, target: JsonObject, path: Path, patches: Patch[]) => {
  for (const key of Object.keys(base)) {
    if (has(base, key) && !has(target, key)) patches.push({ op: 'remove', path: [...path, key] });
  }
  for (const key of Object.keys(target)) {
    if (!has(target, key)) continue;
    if (has(base, key)) diffValues(base[key], target[key], [...path, key], patches);
    else patches.push({ op: 'add', path: [...path, key], value: target[key] });
  }
};

const diffValues = (base: unknown, target: unknown, path: Path, patches: Patch[]) => {
  if (base === target) return;
  if (Array.isArray(base) && Array.isArray(target)) {
    diffArrays(base, target, path, patches);
  } else if (isObject(base) && isObject(target)) {
    diffObjects(base, target, path, patches);
  } else {
    patches.push({ op: 'replace', path, value: target });
  }
};

/** Patches that turn `base` into `target`. Neither argument is modified. */
export const diff = (base: unknown, target: unknown): Patch[] => {
  const patches: Patch[] = [];
  diffValues(base, target, [], patches);
  return patches;
};
