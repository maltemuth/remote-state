/**
 * Serializes async work per game, so that read-validate-execute-write of one action
 * cannot interleave with another action on the same game. In-process only.
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
