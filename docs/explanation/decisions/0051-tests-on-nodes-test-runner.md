# 0051. Tests run on Node's test runner, through tsx

Status: Accepted; npm doesn't read `allowScripts`, so installs use `--ignore-scripts` since [0064](0064-install-without-scripts.md)
Date: 2026-10-17

## Context

[0004](0004-esm-with-jest.md) kept the tests on Jest, in its native ESM mode with `ts-jest`. `npm audit` then reported 21 findings in that tooling:

- Three in `handlebars`, which `ts-jest` uses only for `config:init`, fixed by updating it to 4.7.10.
- Eighteen for one advisory, [GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c), a denial of service in `sprintf-js`, which has no fixed version. Jest brings it in whatever its configuration: `@jest/transform` depends on `babel-plugin-istanbul`, whose `@istanbuljs/load-nyc-config` still uses `js-yaml` 3, `argparse` 1 and `sprintf-js`. Jest 30.5.2 was the latest release.

[0003](0003-no-known-vulnerabilities.md) requires 0 findings and prefers replacing a dependency over overriding its transitive dependencies.

## Decision

- **Tests run on `node:test` and assert with `node:assert/strict`.** Each package's `test` script type-checks, then runs `node --import tsx --test` over `__test__/**/*.test.ts`.
- **tsx loads the TypeScript** as ES modules, resolving the `.js` imports to the `.ts` files and compiling the entities' standard decorators. It replaces Jest, `ts-jest`, `@jest/globals` and the Jest configuration.
- **Mocks come from `node:test`:** `mock.fn` and `mock.method`.

## Alternatives considered

- **Vitest.** Keeps `expect`, so the change would have been smaller, and had no findings. Its compiler only handles TypeScript's experimental decorators, so the entities would have needed swc added as a plugin: about three times tsx's packages, with two native compilers.
- **`npm overrides` for `js-yaml` under Jest.** Ruled out by 0003.
- **Node's test runner on `tsc`'s output.** No added dependency, but tests would run against a build step's output rather than the sources.

## Consequences

- `npm audit` reports 0 findings.
- No Node flag is needed, so the `ExperimentalWarning` for VM modules is gone.
- `ts-jest` no longer holds TypeScript at version 6; `typescript-eslint` still does.
- Node's runner has no default timeout per test; the property tests set theirs as a test option.
- Expected errors give their whole message, since `assert.throws` compares messages exactly where Jest's `toThrow` matched part of one.
- `esbuild`, which tsx compiles with, ships its binaries as packages; its install script is denied in `allowScripts`, as are `fsevents`', which ships prebuilt.
