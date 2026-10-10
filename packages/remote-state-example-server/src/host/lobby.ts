/**
 * The example's host endpoints for one game: create a game, and get a code to join
 * one. There's no login, so anyone may do both, and every request is a new person
 * (decision 0020). A real host would check its own users here before calling the
 * library.
 */

import { randomUUID } from "crypto";
import express, {
  type NextFunction,
  type Request,
  type Response,
  Router,
} from "express";
import { type RemoteState, UnknownGameError } from "@malte.muth/remote-state";

export const createLobby = <StateType>(
  remote: Pick<RemoteState<StateType>, "createGame" | "admit">,
  newGame: () => StateType,
): Router => {
  const lobby = Router();
  lobby.use(express.json());

  // A new game, with nobody in it yet
  lobby.post("/games", async (_req, res) => {
    res.status(201).json({ gameId: await remote.createGame(newGame()) });
  });

  // A code for the client to exchange at POST …/api/tokens
  lobby.post("/games/:gameId/codes", async (req, res) => {
    const name = typeof req.body?.name === "string" ? req.body.name : "";
    const code = await remote.admit({
      gameId: req.params.gameId,
      identity: { id: randomUUID(), name },
    });
    res.status(201).json({ code });
  });

  // Express 5 passes rejected handlers here
  lobby.use((err: unknown, _req: Request, res: Response, next: NextFunction) =>
    err instanceof UnknownGameError
      ? res.status(404).json({ error: err.message })
      : next(err),
  );

  return lobby;
};
