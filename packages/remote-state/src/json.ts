/**
 * Normalizes values to plain JSON, the form in which states are stored, diffed and
 * sent. The rules may return dates or other values with a JSON form; after this, the
 * diffs always match what's stored. Keys that Immer won't patch are dropped, so
 * every client can apply every patch (decision 0047).
 */

/** Immer refuses patches through these keys, and loses an own `__proto__` when cloning */
export const RESERVED_KEYS: ReadonlySet<string> = new Set(['__proto__', 'constructor']);

/**
 * @param onDropped - called once with the reserved keys that were dropped, if any
 */
export const toJson = <T>(value: T, onDropped?: (keys: string[]) => void): T => {
  const dropped = new Set<string>();
  const result = JSON.parse(JSON.stringify(value), (key, item: unknown) => {
    if (!RESERVED_KEYS.has(key)) return item;
    dropped.add(key);
    return undefined;
  }) as T;
  if (dropped.size > 0) onDropped?.([...dropped]);
  return result;
};

/** The warning for a state that had reserved keys */
export const droppedKeysWarning = (keys: string[], spaceId: string, sequence: number) =>
  `Dropped keys named ${keys.join(' and ')} from the state of space ${spaceId} at ${sequence}; ` +
  'clients would fail to apply patches through them';
