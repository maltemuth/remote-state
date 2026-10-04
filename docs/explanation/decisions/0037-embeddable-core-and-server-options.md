# 0037. The library is an embeddable core; deployment settings are server options

Status: Accepted
Date: 2026-10-04

## Context

The library created its own Express app and HTTP server, read its port, database, logging and CORS settings from the game plugin's `serverConfiguration`, logged to the console through a process-wide level, and exited the process on shutdown. That suits a demo, not a library inside someone else's server ([Goals](../goals.md)): the host couldn't mount it in its own app, deploy the same game with different settings, use its own logger, or decide when its process ends.

## Decision

- **An embeddable core,** `createRemoteState(plugin, options)`, returns an Express router for the host's app, `attach(httpServer)` for the socket, the host API (`createGame`, `admit`) and `close()`. It never listens on a port or exits the process, and `close()` leaves the host's HTTP server running.
- **A standalone server,** `createRemoteStateServer(plugin, options)`, wraps the core with its own app and HTTP server, for hosts that don't have one. It reports the port it actually listens on.
- **Deployment settings are options, not part of the game:** `database`, `logger`, `cors` (for HTTP and the socket), `socket` (its path, or `false`), and `port` for the standalone server.
- **Logging goes through a `Logger` per server,** the console by default; MikroORM's output, including the migrator's, goes through it too. There's no global log level.

## Alternatives considered

- **Keeping one standalone server with more options.** Simpler, but a host with an existing app would still need a second server and port.
- **Accepting the host's app and server as options** instead of returning a router. The library would then decide where its routes go; a router lets the host mount it under any prefix, next to its own routes.

## Consequences

- The same game can be deployed with different settings, and tests can run it in memory with a silent logger.
- Several instances, for different games, can share one app and server ([0038](0038-several-games-by-mounting-several-instances.md)).
- Breaking for every host: `serverConfiguration`, `shutdown()`, the global logger functions and `minimumLogLevel` are gone.
- Host routes don't get the library's JSON parsing or error handling, which apply to its `/api` routes only.
