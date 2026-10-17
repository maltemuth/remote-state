# 0058. rfc6902 stays, as the reference our diff is tested against, and as an option

Status: Accepted
Date: 2026-10-17

## Context

[0057](0057-own-diff-arrays-by-position.md) replaced `rfc6902` with a diff of the library's own, for speed, and dropped the dependency. The library has to guarantee that states, and so the patches clients apply, are correct. A faster implementation is only as trustworthy as what it's checked against, and an established library is the best check available.

## Decision

- **`rfc6902` stays a dependency.** Its diff, converted to Immer's format as before, is the reference.
- **The library's own diff is tested against it:** on generated pairs of JSON values, both diffs' patches, applied with Immer, must lead to the same value, the target, and be empty for the same pairs. Every test that holds a diff to Immer's format runs with both, and so do the end-to-end convergence properties.
- **The diff is a deployment option,** `diff: 'positional' | 'rfc6902'`, `positional` by default. A host that doubts a patch can switch to the reference without a new release. The load test takes `--diff` too, to compare them.

## Alternatives considered

- **Dropping `rfc6902`, as 0057 did.** Leaves the library's own diff checked only against itself and Immer.
- **Keeping `rfc6902` for tests only, as a dev dependency.** Keeps the check, but a host couldn't fall back to it.

## Consequences

- The library ships both diffs. `rfc6902` adds no dependencies of its own.
- Every optimization of the diff has a reference to be tested against.
- Under full load in the `immer` format, a Windows desktop handled about 323 actions per second with `positional` and about 188 with `rfc6902`.
