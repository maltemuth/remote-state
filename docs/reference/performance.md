# Performance measurements

Results of the load test, as measured. For how to run it, see [Measure performance](../how-to/measure-performance.md).

## 2026-10-04, version 0.4.2

**Environment**

|                  |                                                                              |
| ---------------- | ---------------------------------------------------------------------------- |
| Machine          | MacBook Pro (MacBookPro14,2), Intel Core i5-7267U, 2 cores, 3.1 GHz, 8 GB    |
| Operating system | macOS 13.7.6                                                                 |
| Node.js          | 24.21.0                                                                      |
| Server           | The example server in its own process, SQLite files in a temporary directory |
| Client           | The load test, in a second process on the same machine                       |

**Scenario:** battleship games played at the same time, each with two players connected over the socket, 17 actions per game.

**Results** (latencies in milliseconds)

| Command                      | Actions | Duration | Actions/s | Errors | HTTP p50 | HTTP p95 | HTTP p99 | HTTP max | End-to-end p50 | End-to-end p95 | End-to-end p99 | End-to-end max |
| ---------------------------- | ------- | -------- | --------- | ------ | -------- | -------- | -------- | -------- | -------------- | -------------- | -------------- | -------------- |
| `--games 1`                  | 17      | 0.3 s    | 50        | 0      | 9.2      | 14.1     | 14.1     | 14.1     | 8.8            | 13.3           | 13.3           | 13.3           |
| `--games 100`                | 1700    | 18.5 s   | 92        | 0      | 87.7     | 4008.9   | 8705.5   | 9629.9   | 87.3           | 4008.7         | 8705.3         | 9629.2         |
| `--games 100 --format immer` | 1700    | 16.3 s   | 104       | 0      | 82.4     | 3165.7   | 7849.2   | 8911.3   | 82.1           | 3165.5         | 7848.8         | 8910.9         |
| `--games 100 --pause 500`    | 1700    | 17.6 s   | 97        | 0      | 151.3    | 354.8    | 982.8    | 2307.4   | 150.8          | 354.6          | 982.6          | 2306.9         |
| `--games 100 --pause 2000`   | 1700    | 44.4 s   | 38        | 0      | 12.8     | 29.1     | 87.2     | 159.3    | 12.4           | 28.8           | 86.9           | 158.9          |

Each command was run once, as `node dist/perf/run.js <command>` in `packages/remote-state-example-server`, after `npm run build`.
