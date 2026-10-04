/**
 * Errors the host API throws that hosts may want to tell apart, for example to
 * answer their own clients with 404.
 */

export class UnknownGameError extends Error {
  constructor(gameId: string) {
    super(`Game ${gameId} not found`);
    this.name = 'UnknownGameError';
  }
}
