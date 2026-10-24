/**
 * Errors the host API throws that hosts may want to tell apart, for example to
 * answer their own clients with 404.
 */

export class UnknownSpaceError extends Error {
  constructor(spaceId: string) {
    super(`Space ${spaceId} not found`);
    this.name = 'UnknownSpaceError';
  }
}
