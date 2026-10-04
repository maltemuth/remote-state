/**
 * The error a game throws to refuse something on purpose, such as a join when the
 * game is full. Its message is sent to the client; any other error is a server error.
 */

export class GameRefusal extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'GameRefusal';
  }
}
