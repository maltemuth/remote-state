# 0004. ESM throughout, tested with Jest

Status: Accepted
Date: 2026-09-29

## Context

The example server was an ES module, but the library was CommonJS. Mixing the two complicated the configuration: TypeScript needed different module settings per package, the e2e tests had to compile ESM sources down to CommonJS, and several dependencies are now ESM-only.

## Decision

Every package is an ES module (`"type": "module"`), and relative imports use explicit `.js` extensions. The library publishes an `exports` map.

Tests stay on Jest, run in its native ESM mode. That mode needs Node's `--experimental-vm-modules` flag, which the `test` scripts set. `ts-jest` only transpiles; a separate `typecheck` step type-checks the tests.

## Alternatives considered

- **Keeping the library CommonJS.** It avoided the migration, but kept two module systems in one repository.
- **Switching to Vitest.** Vitest runs TypeScript and ESM without flags, and would remove `ts-jest`, one of the two tools holding TypeScript at version 6. It was rejected in favor of Jest's maturity; the experimental flag was judged acceptable.

## Consequences

- On Node 24, CommonJS code can still `require()` the library ([0002](0002-node-24.md)).
- Every test run prints an `ExperimentalWarning` for VM modules.
- TypeScript 7 stays out of reach until `ts-jest` and `typescript-eslint` support it.
- Under ESM, `emitDecoratorMetadata` crashed on import cycles between models. This fed into the choice of standard decorators ([0005](0005-mikro-orm.md)).
