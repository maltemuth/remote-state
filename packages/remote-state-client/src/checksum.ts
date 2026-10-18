/**
 * The checksum the server sends with patches unless its `checksums` option is off
 * (decision 0059): cyrb53 over the view's canonical JSON, with keys sorted. It
 * must match the server's `checksumOf`, which the tests check on generated values.
 */

/** JSON with every object's keys in sorted order */
export const canonicalJson = (value: unknown): string => {
  const json = (value as { toJSON?: () => unknown } | null)?.toJSON;
  if (typeof json === 'function') return canonicalJson(json.call(value));
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) {
    return `[${value.map(item => (item === undefined ? 'null' : canonicalJson(item))).join(',')}]`;
  }
  const entries = Object.keys(value)
    .filter(key => (value as Record<string, unknown>)[key] !== undefined)
    .sort()
    .map(key => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`);
  return `{${entries.join(',')}}`;
};

/** cyrb53, a fast 53-bit string hash by bryc, in the public domain */
const cyrb53 = (text: string): number => {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
};

/** The checksum of a view: a safe integer */
export const checksumOf = (view: unknown): number => cyrb53(canonicalJson(view));
