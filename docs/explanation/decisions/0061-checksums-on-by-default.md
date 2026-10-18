# 0061. Checksums are on by default

Status: Accepted
Date: 2026-10-18

## Context

[0059](0059-checksums-with-patches.md) made checksums an option, off by default, to spare servers their cost. Guaranteed state sync is one of the library's core goals, and checksums are how a client finds out that its view isn't the server's. In the load test, they cost about 4% more server CPU per action ([measurements](../../reference/performance.md)).

## Decision

`checksums` is `true` by default. `checksums: false` turns them off.

## Alternatives considered

- **Off by default, as in 0059.** Leaves the check to hosts that know to ask for it.
- **Always on, without the option.** Takes away the choice from a host that measured and needs the CPU.

## Consequences

- Every patch, on the socket and from `GET …/updates`, carries a checksum unless the host turns it off, and the client package checks them.
- The load test keeps its `--checksums` flag, so its baseline stays comparable with earlier results; without it, the started server runs with `checksums: false`.
