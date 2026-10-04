/**
 * Normalizes values to plain JSON, the form in which states are stored, diffed and
 * sent. A game may return dates or other values with a JSON form; after this, the
 * diffs always match what's stored.
 */

export const toJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
