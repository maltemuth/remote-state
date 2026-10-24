/**
 * The example's host endpoints for one game: create a game, get a code to join
 * one, and, for a game that pauses on a server restart, resume it. There's no
 * login, so anyone may do all three, and every request is a new person (decision
 * 0020). A real host would check its own users here before calling the library,
 * and let only a game's host resume it.
 */

import { randomUUID } from "crypto";
import express, {
  type NextFunction,
  type Request,
  type Response,
  Router,
} from "express";
import { type RemoteState, UnknownSpaceError } from "@malte.muth/remote-state";

export const createLobby = <StateType>(
  remote: Pick<RemoteState<StateType>, "createSpace" | "admit" | "dispatch">,
  newGame: () => StateType,
  /** The system action that resumes a paused game; without it, there's no endpoint */
  resume?: unknown,
): Router => {
  const lobby = Router();
  lobby.use(express.json());

  // A new game, with nobody in it yet
  lobby.post("/games", async (_req, res) => {
    res.status(201).json({ gameId: await remote.createSpace(newGame()) });
  });

  // A code for the client to exchange at POST …/api/tokens
  lobby.post("/games/:gameId/codes", async (req, res) => {
    const name = typeof req.body?.name === "string" ? req.body.name : "";
    const code = await remote.admit({
      spaceId: req.params.gameId,
      identity: { id: randomUUID(), name },
    });
    res.status(201).json({ code });
  });

  // Resume a game a server restart paused, once its players are back
  if (resume !== undefined) {
    lobby.post("/games/:gameId/resume", async (req, res) => {
      const result = await remote.dispatch(req.params.gameId, resume);
      if ("rejected" in result)
        res.status(400).json({ error: result.rejected });
      else res.status(201).json(result);
    });
  }

  // Express 5 passes rejected handlers here
  lobby.use((err: unknown, _req: Request, res: Response, next: NextFunction) =>
    err instanceof UnknownSpaceError
      ? res.status(404).json({ error: err.message })
      : next(err),
  );

  return lobby;
};
