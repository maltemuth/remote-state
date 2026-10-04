/**
 * Serves the client package and its dependencies to browsers as ES modules under
 * /modules, so the example page can import them through an import map, without a
 * bundler. Files are resolved from the installed packages.
 */

import express, { type Router } from "express";
import path from "path";
import { fileURLToPath } from "url";

const installed = (specifier: string) =>
  fileURLToPath(import.meta.resolve(specifier));

/** The paths the page's import map points to */
export const browserModules = {
  "@malte.muth/remote-state-client": "/modules/remote-state-client/index.js",
  immer: "/modules/immer.mjs",
  "socket.io-client": "/modules/socket.io-client.mjs",
};

export const serveBrowserModules = (): Router => {
  const router = express.Router();
  const clientDirectory = path.dirname(
    installed("@malte.muth/remote-state-client"),
  );
  const immerDirectory = path.dirname(installed("immer"));
  const socketIoDirectory = path.dirname(installed("socket.io-client"));

  router.use("/modules/remote-state-client", express.static(clientDirectory));
  router.get("/modules/immer.mjs", (_req, res) =>
    res.sendFile(path.join(immerDirectory, "immer.production.mjs")),
  );
  router.get("/modules/socket.io-client.mjs", (_req, res) =>
    // Node resolves to a build for Node, in build/esm-debug; the browser bundle is in dist
    res.sendFile(
      path.join(socketIoDirectory, "../../dist/socket.io.esm.min.js"),
    ),
  );
  return router;
};
