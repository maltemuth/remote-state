/**
 * Tic-tac-toe across a restart of the example host on its database: a game whose
 * turn was running is paused, and the lobby resumes it with the turn's full time.
 */

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { silentLogger } from "@malte.muth/remote-state";
import request from "supertest";
import {
  createExampleServer,
  type ExampleServer,
} from "../../src/host/servers.js";
import { newTicTacToeGame } from "../../src/games/tic-tac-toe/rules.js";
import type { TicTacToeState } from "../../src/games/tic-tac-toe/types.js";
import { clientFor } from "../helpers/client.js";

describe("Tic-tac-toe across a restart", () => {
  const databaseDirectory = mkdtempSync(join(tmpdir(), "tic-tac-toe-restart-"));
  let example: ExampleServer;
  // `after` hooks run in the order they're declared: close the databases
  // before removing their directory, which Windows refuses while they're open
  after(() => example.close());
  after(() => rmSync(databaseDirectory, { recursive: true, force: true }));

  const start = async () => {
    example = await createExampleServer({
      logger: silentLogger,
      databaseDirectory,
    });
    return clientFor(example.app, "/tic-tac-toe");
  };
  const resume = (gameId: string) =>
    request(example.app).post(`/tic-tac-toe/lobby/games/${gameId}/resume`);

  it("pauses a running game until the host resumes it", async () => {
    let client = await start();
    const gameId = await example.ticTacToe.createGame(
      newTicTacToeGame({ turnSeconds: 0.1 }),
    );
    const x = await client.joinAs(gameId, "Xena");
    await client.joinAs(gameId, "Otto");

    await example.close();
    client = await start();

    const state = () => client.stateFor<TicTacToeState>(gameId, x.token);
    assert.equal((await state()).paused, true);
    assert.equal(
      (
        await client
          .act(gameId, x.token, { type: "place", row: 0, col: 0 })
          .expect(400)
      ).body.error,
      "The game is paused",
    );
    // the turn's clock doesn't run: well past the limit, nobody has lost
    await new Promise((resolve) => setTimeout(resolve, 250));
    assert.equal((await state()).outcome, null);

    await resume(gameId).expect(201);
    assert.equal(
      (await resume(gameId).expect(400)).body.error,
      "The game isn't paused",
    );
    // the turn starts over, and X, who never moves, loses on time
    for (let i = 0; i < 100 && !(await state()).outcome; i++) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    assert.deepEqual((await state()).outcome, { winner: "O", timeout: true });
  });

  it("answers 404 for resuming an unknown game", async () => {
    await resume("nope").expect(404);
  });
});
