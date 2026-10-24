/**
 * Serializes work per space, so that reading, running the rules, recording
 * and broadcasting one transition can't interleave with another. In-process only
 * (decision 0006).
 */

export const createSpaceLock = () => {
  const tails = new Map<string, Promise<unknown>>();

  return <T>(spaceId: string, work: () => Promise<T>): Promise<T> => {
    const previous = tails.get(spaceId) ?? Promise.resolve();
    // Run after the previous task settles, whether it succeeded or failed
    const result = previous.then(work, work);
    const tail = result.catch(() => undefined);
    tails.set(spaceId, tail);
    void tail.then(() => {
      if (tails.get(spaceId) === tail) {
        tails.delete(spaceId);
      }
    });
    return result;
  };
};

export type SpaceLock = ReturnType<typeof createSpaceLock>;
