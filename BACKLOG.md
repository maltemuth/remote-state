# Backlog

Planned work that doesn't depend on open design questions. Work that does is discussed in [design proposals](docs/explanation/designs/README.md) first.

Remove an item when it's done; the changelog records what changed.

## Architecture fixes

The library should behave like a library: its host application stays in control of the process, configuration and logging.

- [ ] **Clean up admission codes.** Used and expired codes stay in `admission_codes` for good. Delete them, for example when a new code is issued.

## Before the first release

Each of these makes a check in [Publish a release](docs/how-to/publish-a-release.md) fail today.

- [ ] Add `"files": ["dist"]` to the library's `package.json`. `npm pack` currently includes 69 files: sources, tests and config files.
- [ ] Add a `LICENSE` file. `package.json` declares MIT, but the repository has no license text.
- [ ] Add a README to the library package, for its npm page. It should tell users they can deny `better-sqlite3`'s install script when npm 11 asks: the package ships prebuilt binaries, and the library works without the script.
- [ ] Add `repository`, `homepage`, `bugs` and `keywords` to the library's `package.json`.
- [ ] Add `"publishConfig": { "access": "public" }`. Scoped packages are private by default.
- [ ] Add a `prepublishOnly` script that builds, so a stale `dist/` can't be published.
- [ ] Mark the example server package `"private": true`, so it can't be published by mistake.
