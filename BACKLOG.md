# Backlog

Planned work that doesn't depend on open design questions. Work that does is discussed in [design proposals](docs/explanation/designs/README.md) first.

Remove an item when it's done; the changelog records what changed.

## Architecture fixes

The library should behave like a library: its host application stays in control of the process, configuration and logging.

- [ ] **Separate deployment settings from the game.** Port, database, logging, CORS and Socket.IO settings currently live in `plugin.serverConfiguration`, with the port as a separate argument. Move them into a server options argument, so the same game definition can be deployed with different settings.
- [ ] **Never exit the host process.** `shutdown()` calls `process.exit()` unless it's passed `false`. It should only release resources, and leave exiting to the host.
- [ ] **Per-server logging.** `minimumLogLevel` sets a process-wide log level, and output always goes to the console. Make the level per server instance, and accept a logger from the host. MikroORM's own output needs routing through it too: the migrator currently prints `[migrator] …` lines to the console regardless of the log level.
- [ ] **Configurable HTTP CORS.** HTTP allows every origin (`cors()`), while Socket.IO's CORS is already configurable.
- [ ] **Remove `/admin/log-level`, or make it opt-in and authenticated.** Today it's installed unauthenticated unless `NODE_ENV=production`.
- [ ] **Allow embedding.** The library creates its own Express app and HTTP server. Allow mounting it into an existing app or attaching it to an existing server.
- [ ] **Report the actual port.** `server.port` returns the requested port, so with port `0` it doesn't show the port actually used.
- [ ] **More than one game type per server.** Each server hosts exactly one game plugin. This is larger than the other items, and may need a design proposal.

## Before the first release

Each of these makes a check in [Publish a release](docs/how-to/publish-a-release.md) fail today.

- [ ] Add `"files": ["dist"]` to the library's `package.json`. `npm pack` currently includes 69 files: sources, tests and config files.
- [ ] Add a `LICENSE` file. `package.json` declares MIT, but the repository has no license text.
- [ ] Add a README to the library package, for its npm page. It should tell users they can deny `better-sqlite3`'s install script when npm 11 asks: the package ships prebuilt binaries, and the library works without the script.
- [ ] Add `repository`, `homepage`, `bugs` and `keywords` to the library's `package.json`.
- [ ] Add `"publishConfig": { "access": "public" }`. Scoped packages are private by default.
- [ ] Add a `prepublishOnly` script that builds, so a stale `dist/` can't be published.
- [ ] Mark the example server package `"private": true`, so it can't be published by mistake.
