/**
 * The error the rules throw to refuse something on purpose, such as a join when the
 * space is full. Its message is sent to the client; any other error is a server error.
 */

export class Refusal extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'Refusal';
  }
}
