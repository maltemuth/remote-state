/**
 * Serializes work per game, so that reading, running the game's rules, recording
 * and broadcasting one transition can't interleave with another. In-process only
 * (decision 0006).
 */

export const createGameLock = () => {
  const tails = new Map<string, Promise<unknown>>();

  return <T>(gameId: string, work: () => Promise<T>): Promise<T> => {
    const previous = tails.get(gameId) ?? Promise.resolve();
    // Run after the previous task settles, whether it succeeded or failed
    const result = previous.then(work, work);
    const tail = result.catch(() => undefined);
    tails.set(gameId, tail);
    void tail.then(() => {
      if (tails.get(gameId) === tail) {
        tails.delete(gameId);
      }
    });
    return result;
  };
};

export type GameLock = ReturnType<typeof createGameLock>;
