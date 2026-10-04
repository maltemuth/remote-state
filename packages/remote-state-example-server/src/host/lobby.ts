/**
 * The example's host endpoints: create a game, and get a code to join one. There's
 * no login, so anyone may do both, and every request is a new person (decision
 * 0020). A real host would check its own users here before calling the library.
 */

import { randomUUID } from "crypto";
import type { NextFunction, Request, Response } from "express";
import {
  type RemoteStateServer,
  UnknownGameError,
} from "@malte.muth/remote-state";

type Handler = (
  req: Request<{ gameId: string }>,
  res: Response,
) => Promise<void>;

const handle =
  (handler: Handler) =>
  (req: Request<{ gameId: string }>, res: Response, next: NextFunction) =>
    handler(req, res).catch((err) =>
      err instanceof UnknownGameError
        ? res.status(404).json({ error: err.message })
        : next(err),
    );

export const addLobby = <StateType>(
  server: RemoteStateServer<StateType>,
  newGame: () => StateType,
) => {
  // A new game, with nobody in it yet
  server.app.post(
    "/lobby/games",
    handle(async (_req, res) => {
      res.status(201).json({ gameId: await server.createGame(newGame()) });
    }),
  );

  // A code for the client to exchange at POST /api/tokens
  server.app.post(
    "/lobby/games/:gameId/codes",
    handle(async (req, res) => {
      const name = typeof req.body?.name === "string" ? req.body.name : "";
      const code = await server.admit({
        gameId: req.params.gameId,
        identity: { id: randomUUID(), name },
      });
      res.status(201).json({ code });
    }),
  );
};
