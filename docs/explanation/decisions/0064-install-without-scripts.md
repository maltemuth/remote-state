# 0064. Install with --ignore-scripts until npm honours gypfile: false

Status: Accepted
Date: 2026-10-23

## Context

`better-sqlite3` 13 ships prebuilt binaries and has no install script. It also ships a `binding.gyp`, and sets `"gypfile": false` so that npm doesn't add its implicit `node-gyp rebuild` install step ([0005](0005-mikro-orm.md)).

npm honours that flag only on a fresh install, where it reads the whole manifest from the registry. Installing from a lockfile ignores it: `npm ci`, and `npm install` without `node_modules`. The lockfile doesn't record `gypfile`, so npm finds the `binding.gyp` and runs `node-gyp rebuild`. On a machine without a C++ toolchain, such as Windows without Visual Studio's build tools, the build fails, and with it the install. npm 10.9.2 and 11.13.0 both do this. Fixes are open as [npm/cli#9859](https://github.com/npm/cli/pull/9859) and [npm/cli#10061](https://github.com/npm/cli/pull/10061).

The root `package.json`'s `allowScripts` doesn't prevent it. npm 11.13.0 doesn't read that field: with `"better-sqlite3": false` there, `npm ci` still ran the build.

This affects this repository, and every app that depends on `@malte.muth/remote-state`, since its lockfile lists `better-sqlite3` too.

## Decision

- **Install with `--ignore-scripts`:** `npm ci --ignore-scripts`, and `npm install --ignore-scripts`. No package in this repository's tree needs an install script: `better-sqlite3` and `esbuild` ship their binaries, and `fsevents` ships prebuilt.
- **The docs say so,** for maintainers and for hosts, with the reason, until npm releases a fix.
- **Only on the install command.** The flag isn't kept anywhere, so `npm test` and `npm run build` run as before, with their `pre` scripts.

## Alternatives considered

- **`ignore-scripts=true` in a project `.npmrc`.** A plain `npm install` would work in this repository, but it would also skip the `pretest` and `prepack` scripts, silently. It wouldn't help hosts either, whose installs don't read this repository's `.npmrc`.
- **Another SQLite driver,** such as `node:sqlite`. MikroORM 7's driver for it was not evaluated. Changing drivers is a larger decision than working around an npm bug.
- **Waiting for npm.** Installs from the lockfile fail until then, on every machine without a compiler.

## Consequences

- `npm ci --ignore-scripts` installs this repository on Windows without build tools, with `better-sqlite3` working.
- Contributors and hosts must remember the flag. Without it, they see a `node-gyp` error that's unrelated to their change.
- Once npm releases a fix, this decision can be superseded, and the docs go back to plain `npm ci`.
- 0005 said no install script runs for `better-sqlite3`, and 0051 that `allowScripts` denies install scripts. Neither holds for installs from a lockfile.
