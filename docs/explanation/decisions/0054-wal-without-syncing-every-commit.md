# 0054. Commits go to a write-ahead log, not synced one by one

Status: Accepted
Date: 2026-10-17

## Context

Every action is one transaction, and with SQLite's defaults (`journal_mode = DELETE`, `synchronous = FULL`) every commit waits for the disk, several times. `better-sqlite3` is synchronous, so the whole process waits with it. On a Windows desktop, a commit took 8.9 ms, and commits were 59% of the server's time under full load, which held it to 49 actions per second with a median latency of 1.7 seconds ([measurements](../../reference/performance.md)).

Option A of [Throughput and persistence](../designs/throughput-and-persistence.md) had been measured on 0.6.0 and set aside, because it changes what a commit promises.

What matters after a crash is that the database holds a well-defined state, a consistent one, more than that it holds the very latest action.

## Decision

The library opens databases with `journal_mode = WAL` and `synchronous = NORMAL`. It sets them after checking the schema's version, so a database it refuses is left as it was.

- A crash of the server process loses nothing that was committed.
- An operating system crash or a power loss can lose the last commits. The database stays consistent: it holds every action up to some point, and none after it.

## Alternatives considered

- **WAL with `synchronous = FULL`.** Every commit stays on disk before it's answered, and a commit took 2.9 ms instead of 8.9 ms. Still the largest cost per action, for a guarantee that isn't needed.
- **Keeping SQLite's defaults.** Durable, and the slowest.
- **Group commit,** several games' transactions synced as one. Durable and fast under load, but restructures how transitions are recorded.
- **A setting for hosts.** Leaves every host to choose a trade-off that has one sensible answer for games.

## Consequences

- A commit took 0.03 ms instead of 8.9 ms. Under full load, the same machine handled 133 actions per second instead of 49, and at human pace the median latency fell from about 60 ms to 9 ms.
- A database has two more files next to it while it's open, `-wal` and `-shm`. Backups have to use SQLite's backup, or copy the files while the server is stopped.
- WAL doesn't work on network file systems.
- The journal mode is stored in the file, so a database stays in WAL once the library has opened it.
