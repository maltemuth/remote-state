# Performance measurements

Results of the load test, as measured. For how to run it, see [Measure performance](../how-to/measure-performance.md).

## 2026-10-17, the library's own diff, after 0.9.1

As the next section, with patches from the library's own diff instead of `rfc6902` ([0057](../explanation/decisions/0057-own-diff-arrays-by-position.md)), in the `immer` format.

| Command                                          | Run | Actions | Duration | Actions/s | Errors | HTTP p50 | HTTP p95 | HTTP p99 | HTTP max |
| ------------------------------------------------ | --- | ------- | -------- | --------- | ------ | -------- | -------- | -------- | -------- |
| `--games 100 --pause 0 --runs 3 --format immer`  | 1   | 4300    | 13.3 s   | 324       | 0      | 277.1    | 287.1    | 290.0    | 356.4    |
|                                                  | 2   | 4300    | 13.1 s   | 327       | 0      | 276.9    | 282.9    | 286.3    | 515.0    |
|                                                  | 3   | 4300    | 16.0 s   | 269       | 0      | 278.0    | 286.0    | 288.2    | 465.8    |
| `--games 100 --pause 0 --format immer --profile` | 1   | 4300    | 14.8 s   | 290       | 0      | 298.6    | 316.0    | 535.4    | 536.6    |
| `--games 100 --pause 2000 --format immer`        | 1   | 4300    | 98.0 s   | 44        | 0      | 3.1      | 7.8      | 22.4     | 36.9     |

The third run's duration includes a pause without errors, while its latencies match the others.

Own time by package: remote-state 25.4%, kysely 19.8%, @mikro-orm/core 19.4%, @mikro-orm/sql 9.8%, better-sqlite3 5.9%. The largest functions are `toJson` (22.2%) and the driver's `executeQuery` (18.9%); the diff doesn't appear among them.

## 2026-10-17, views and patches computed when sent, after 0.9.1

The same machine as the next sections, with WAL, and without stored per-audience diffs: views and patches are computed after the commit, only for connected sockets ([0056](../explanation/decisions/0056-views-and-patches-computed-when-sent.md)). The load test's clients use the `state` format, so they get views and no patches are computed.

**Results** (latencies in milliseconds)

| Command                           | Run | Actions | Duration | Actions/s | Errors | HTTP p50 | HTTP p95 | HTTP p99 | HTTP max |
| --------------------------------- | --- | ------- | -------- | --------- | ------ | -------- | -------- | -------- | -------- |
| `--games 100 --pause 0 --runs 3`  | 1   | 4300    | 15.2 s   | 282       | 0      | 312.3    | 324.9    | 329.2    | 577.2    |
|                                   | 2   | 4300    | 15.3 s   | 281       | 0      | 313.1    | 339.1    | 354.4    | 386.4    |
|                                   | 3   | 4300    | 15.0 s   | 286       | 0      | 310.2    | 329.4    | 338.4    | 546.3    |
| `--games 100 --pause 0 --profile` | 1   | 4300    | 15.4 s   | 279       | 0      | 315.7    | 335.6    | 349.0    | 602.6    |
| `--games 100 --pause 2000`        | 1   | 4300    | 95.9 s   | 45        | 0      | 4.9      | 9.9      | 18.8     | 36.2     |

**CPU profile,** own time by package: @mikro-orm/core 21.7%, remote-state 19.5%, kysely 16.8%, @mikro-orm/sql 11.3%, better-sqlite3 6.0%, node 5.3%. `rfc6902` doesn't appear. The largest functions are `toJson` (17.8%) and the driver's `executeQuery` (15.8%).

**With `--format immer`,** the same commit, so each connected player's patch is computed:

| Command                                          | Run | Actions | Duration | Actions/s | Errors | HTTP p50 | HTTP p95 | HTTP p99 | HTTP max |
| ------------------------------------------------ | --- | ------- | -------- | --------- | ------ | -------- | -------- | -------- | -------- |
| `--games 100 --pause 0 --runs 3 --format immer`  | 1   | 4300    | 22.3 s   | 193       | 0      | 468.7    | 653.7    | 735.1    | 773.8    |
|                                                  | 2   | 4300    | 22.2 s   | 194       | 0      | 467.8    | 653.4    | 750.0    | 806.5    |
|                                                  | 3   | 4300    | 22.6 s   | 190       | 0      | 461.9    | 705.7    | 771.8    | 921.2    |
| `--games 100 --pause 0 --format immer --profile` | 1   | 4300    | 23.9 s   | 180       | 0      | 497.2    | 695.1    | 803.9    | 847.1    |
| `--games 100 --pause 2000 --format immer`        | 1   | 4300    | 95.0 s   | 45        | 0      | 5.8      | 16.6     | 29.8     | 54.9     |

Own time by package: rfc6902 38.6%, remote-state 16.7%, @mikro-orm/core 12.1%, kysely 10.3%, @mikro-orm/sql 5.7%. About 20% of the time goes to rfc6902's JSON Pointers (`Pointer.add`, `escapeToken`, `Pointer.toString`), which the library then converts to Immer's paths.

## 2026-10-17, WAL without syncing every commit, after 0.9.1

The same machine as the next section, with databases opened with `journal_mode = WAL` and `synchronous = NORMAL` ([0054](../explanation/decisions/0054-wal-without-syncing-every-commit.md)), compared with 0.9.1 and SQLite's defaults.

**Commits,** 300 transactions of one 1.2 kB insert each, timed apart from the server:

| `journal_mode` | `synchronous` | Per commit | Commits/s |
| -------------- | ------------- | ---------- | --------- |
| `DELETE`       | `FULL`        | 8.9 ms     | 112       |
| `TRUNCATE`     | `FULL`        | 10.6 ms    | 94        |
| `PERSIST`      | `FULL`        | 9.6 ms     | 104       |
| `DELETE`       | `NORMAL`      | 6.4 ms     | 156       |
| `WAL`          | `FULL`        | 2.9 ms     | 341       |
| `WAL`          | `NORMAL`      | 0.03 ms    | 34,603    |

**Results** (latencies in milliseconds)

| Command                           | Settings | Run | Actions | Duration | Actions/s | Errors | HTTP p50 | HTTP p95 | HTTP p99 | HTTP max |
| --------------------------------- | -------- | --- | ------- | -------- | --------- | ------ | -------- | -------- | -------- | -------- |
| `--games 100 --pause 0 --profile` | Defaults | 1   | 4300    | 87.2 s   | 49        | 0      | 1704.6   | 1919.9   | 1991.6   | 2576.9   |
| `--games 100 --pause 0 --runs 3`  | WAL      | 1   | 4300    | 32.8 s   | 131       | 0      | 684.6    | 943.5    | 1094.8   | 1413.1   |
|                                   |          | 2   | 4300    | 31.8 s   | 135       | 0      | 669.3    | 912.0    | 1015.4   | 1095.9   |
|                                   |          | 3   | 4300    | 32.5 s   | 132       | 0      | 681.2    | 969.3    | 1109.5   | 1309.8   |
| `--games 100 --pause 0 --profile` | WAL      | 1   | 4300    | 32.0 s   | 134       | 0      | 668.1    | 929.3    | 1065.0   | 1145.6   |
| `--games 100 --pause 2000`        | WAL      | 1   | 4300    | 96.1 s   | 45        | 0      | 8.8      | 27.6     | 50.5     | 103.7    |

End-to-end latencies were within 0.5 ms of the HTTP ones. With the defaults, `--pause 2000` had a p50 of about 60 ms (next section).

**CPU profiles,** own time by package, from the two `--profile` runs:

| Package         | Defaults | WAL   |
| --------------- | -------- | ----- |
| kysely          | 68.8%    | 14.0% |
| rfc6902         | 11.8%    | 33.6% |
| remote-state    | 5.6%     | 16.4% |
| @mikro-orm/core | 4.8%     | 12.2% |
| @mikro-orm/sql  | 2.4%     | 6.2%  |
| better-sqlite3  | 1.5%     | 3.9%  |

With the defaults, committing took 59% of the time including calls. With WAL, the largest functions by own time are `toJson` (14.1%), the driver's `executeQuery` (13.4%) and `rfc6902`'s array diff (about 30% across its functions).

## 2026-10-17, classic battleship on Windows, after 0.8.0

At commit `faa1760`: unreleased changes since 0.8.0, among them that full-state diffs are no longer computed or stored ([0050](../explanation/decisions/0050-full-state-diffs-derived-not-stored.md)). A different machine and operating system from the results below, so the numbers can't be compared with theirs.

**Environment**

|                  |                                                                              |
| ---------------- | ---------------------------------------------------------------------------- |
| Machine          | Desktop, AMD Ryzen 7 5800X3D, 8 cores, 16 threads, 3.4 GHz, 128 GB           |
| Disk             | Samsung SSD 870 EVO 1 TB (SATA), holding the temporary directory             |
| Operating system | Windows 11 Pro 10.0.26200                                                    |
| Node.js          | 24.16.0                                                                      |
| SQLite           | 3.53.4, through `better-sqlite3` 13.0.3, with SQLite's defaults              |
| Server           | The example server in its own process, SQLite files in a temporary directory |
| Client           | The load test, in a second process on the same machine                       |

**Results** (latencies in milliseconds)

| Command                             | Run | Actions | Duration | Actions/s | Errors | HTTP p50 | HTTP p95 | HTTP p99 | HTTP max | End-to-end p50 | End-to-end p95 | End-to-end p99 | End-to-end max |
| ----------------------------------- | --- | ------- | -------- | --------- | ------ | -------- | -------- | -------- | -------- | -------------- | -------------- | -------------- | -------------- |
| `--games 100 --pause 2000 --runs 3` | 1   | 4300    | 109.2 s  | 39        | 0      | 64.1     | 211.4    | 323.7    | 509.2    | 63.8           | 210.8          | 323.4          | 509.0          |
|                                     | 2   | 4300    | 109.8 s  | 39        | 0      | 59.8     | 181.0    | 229.5    | 470.3    | 59.5           | 180.8          | 229.1          | 470.0          |
|                                     | 3   | 4300    | 112.3 s  | 38        | 0      | 56.4     | 180.9    | 289.6    | 568.1    | 56.2           | 180.7          | 289.3          | 567.8          |
| `--games 100 --pause 0 --runs 3`    | 1   | 4300    | 90.5 s   | 47        | 0      | 1808.6   | 2113.4   | 2288.5   | 3237.1   | 1808.4         | 2113.1         | 2288.0         | 3236.9         |
|                                     | 2   | 4300    | 90.5 s   | 47        | 0      | 1809.2   | 2082.2   | 2239.6   | 2864.2   | 1808.8         | 2081.9         | 2239.2         | 2864.0         |
|                                     | 3   | 4300    | 90.2 s   | 48        | 0      | 1802.6   | 2112.3   | 2331.1   | 2623.9   | 1802.4         | 2112.1         | 2330.9         | 2623.7         |

Run as `npm run perf -- <command>` from the repository root. A fourth `--pause 0` run, started with `--profile`, also reached 47 actions/s; it wrote no profile (see below).

**Commits limit throughput on this machine, not the CPU.** Timed apart from the server, with the same driver in the same temporary directory, 300 transactions of one 1.2 kB insert each took:

| SQLite settings                                         | Per commit | Commits/s    |
| ------------------------------------------------------- | ---------- | ------------ |
| Defaults: `journal_mode = DELETE`, `synchronous = FULL` | 9.7 ms     | about 100    |
| `journal_mode = WAL`, `synchronous = NORMAL`            | 0.05 ms    | about 18,000 |

With the defaults, every commit waits for the disk, and 47 actions/s is about 21 ms per action. WAL was one of the persistence experiments on 0.6.0, below.

**Profiling doesn't work on Windows.** The load test stops the server it started with `SIGTERM`, which on Windows ends the process at once, before Node writes the profile that `--profile` asks for. Fixed after 0.9.0: the load test asks the server to stop over IPC, and the server exits by itself and writes the profile.

## 2026-10-05, classic battleship, after 0.8.0

The example's battleship now follows the classic rules: a 10×10 board and five ships per player, 43 actions per game instead of 17. Same environment as for version 0.4.2, below.

| Command                    | Actions | Duration | Actions/s | Errors | HTTP p50 | HTTP p95 | HTTP p99 | HTTP max | End-to-end p50 | End-to-end p95 | End-to-end p99 | End-to-end max |
| -------------------------- | ------- | -------- | --------- | ------ | -------- | -------- | -------- | -------- | -------------- | -------------- | -------------- | -------------- |
| `--games 100 --pause 2000` | 4300    | 105.6 s  | 41        | 0      | 25.5     | 124.0    | 285.7    | 1640.5   | 25.2           | 123.8          | 285.3          | 1640.2         |

The command was run once.

## 2026-10-04, persistence experiments on 0.6.0

Same environment and scenario as for version 0.4.2, below. Every run was `--games 100 --pause 0`, 1700 actions, on version 0.6.0 with experimental switches that have since been removed; see [Throughput and persistence](../explanation/designs/throughput-and-persistence.md). Each line is one run, in the order they ran; the first set was run without `--runs`, the others with `--runs 3`.

| Configuration       | What was different from 0.6.0                                                                                                                                                                                                                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WAL                 | `pragma journal_mode = WAL` and the given `synchronous` level, set when the database opens                                                                                                                                                                                                                                                  |
| State cache         | Each game's latest state kept in memory after every recorded transition, instead of read from the database for every action                                                                                                                                                                                                                 |
| Shared transactions | Transitions ready in the same turn of the event loop written in one transaction, flushed once; each request waits for its batch                                                                                                                                                                                                             |
| Database in memory  | SQLite opened as `:memory:`, with no file at all                                                                                                                                                                                                                                                                                            |
| Split               | Accept: the action is inserted into an action log table and answered with `201 { actionId }`. Execute: a worker per game runs it against a state in memory, broadcasts, sends `executed` or `rejected` to the submitter, then writes the transition. HTTP is the accept response; end to end is until the other player receives the update. |

**Results** (latencies in milliseconds)

| Configuration                                       | Actions/s | Duration | Errors | HTTP p50 | HTTP p95 | HTTP p99 | HTTP max | End-to-end p50 | End-to-end p95 | End-to-end p99 | End-to-end max |
| --------------------------------------------------- | --------- | -------- | ------ | -------- | -------- | -------- | -------- | -------------- | -------------- | -------------- | -------------- |
| As 0.6.0, rollback journal (SQLite's default)       | 94        | 18.1 s   | 0      | 88.7     | 3716.9   | 8679.3   | 9730.7   | 88.3           | 3716.7         | 8678.9         | 9730.5         |
| As 0.6.0, rollback journal (SQLite's default)       | 97        | 17.5 s   | 0      | 83.4     | 3109.6   | 8394.0   | 9531.6   | 83.1           | 3109.3         | 8393.6         | 9530.2         |
| As 0.6.0, rollback journal (SQLite's default)       | 104       | 16.3 s   | 0      | 88.2     | 2696.5   | 8093.0   | 9385.3   | 87.8           | 2696.3         | 8092.6         | 9384.9         |
| WAL, `synchronous=NORMAL`                           | 148       | 11.5 s   | 0      | 81.8     | 153.2    | 177.6    | 216.0    | 81.5           | 153.0          | 177.3          | 215.8          |
| WAL, `synchronous=NORMAL`                           | 147       | 11.6 s   | 0      | 82.1     | 158.0    | 184.4    | 220.8    | 81.9           | 157.7          | 183.9          | 220.6          |
| WAL, `synchronous=NORMAL`                           | 147       | 11.6 s   | 0      | 82.3     | 158.7    | 187.4    | 1604.5   | 82.0           | 158.4          | 187.2          | 1604.2         |
| WAL, `synchronous=NORMAL`                           | 143       | 11.9 s   | 0      | 76.8     | 154.7    | 3814.9   | 6880.8   | 76.5           | 154.4          | 3814.6         | 6880.6         |
| WAL, `synchronous=NORMAL`                           | 148       | 11.5 s   | 0      | 83.5     | 163.6    | 187.2    | 7151.1   | 83.2           | 163.4          | 186.9          | 7150.8         |
| WAL, `synchronous=NORMAL`                           | 150       | 11.3 s   | 0      | 81.8     | 154.0    | 185.0    | 213.8    | 81.6           | 153.7          | 184.7          | 213.5          |
| WAL, `synchronous=OFF`                              | 150       | 11.3 s   | 0      | 81.1     | 152.2    | 182.5    | 218.2    | 80.8           | 151.9          | 182.3          | 218.0          |
| WAL, `synchronous=OFF`                              | 152       | 11.2 s   | 0      | 80.5     | 152.4    | 176.0    | 195.7    | 80.2           | 152.1          | 175.3          | 195.4          |
| WAL, `synchronous=OFF`                              | 152       | 11.2 s   | 0      | 80.2     | 150.8    | 180.4    | 1169.7   | 79.9           | 150.6          | 180.2          | 1169.5         |
| WAL `NORMAL`, state cache                           | 160       | 10.6 s   | 0      | 74.3     | 142.6    | 168.7    | 214.2    | 74.0           | 142.4          | 168.4          | 214.0          |
| WAL `NORMAL`, state cache                           | 159       | 10.7 s   | 0      | 76.0     | 142.0    | 169.9    | 210.8    | 75.6           | 141.5          | 169.7          | 210.6          |
| WAL `NORMAL`, state cache                           | 157       | 10.8 s   | 0      | 76.4     | 145.2    | 175.1    | 6666.7   | 76.1           | 144.9          | 174.8          | 6666.5         |
| WAL `NORMAL`, state cache, shared transactions      | 170       | 10.0 s   | 0      | 110.6    | 235.5    | 2701.9   | 4506.0   | 107.2          | 231.5          | 2697.7         | 4501.1         |
| WAL `NORMAL`, state cache, shared transactions      | 188       | 9.0 s    | 0      | 112.3    | 144.2    | 168.5    | 3763.5   | 108.5          | 140.4          | 161.7          | 3759.5         |
| WAL `NORMAL`, state cache, shared transactions      | 187       | 9.1 s    | 0      | 121.1    | 154.6    | 215.6    | 4088.3   | 117.1          | 150.8          | 210.6          | 4083.3         |
| Rollback journal, state cache, shared transactions  | 149       | 11.4 s   | 0      | 104.8    | 1469.6   | 4344.8   | 4739.4   | 101.3          | 1465.2         | 4339.9         | 4733.7         |
| Rollback journal, state cache, shared transactions  | 150       | 11.3 s   | 0      | 106.2    | 1488.4   | 4349.9   | 4743.9   | 103.2          | 1486.1         | 4339.5         | 4737.4         |
| Rollback journal, state cache, shared transactions  | 149       | 11.4 s   | 0      | 106.5    | 1657.6   | 4433.4   | 4748.7   | 103.3          | 1649.0         | 4427.4         | 4743.0         |
| Database in memory (`:memory:`)                     | 154       | 11.1 s   | 0      | 76.8     | 144.0    | 177.5    | 1973.8   | 76.5           | 143.8          | 177.3          | 1973.6         |
| Database in memory (`:memory:`)                     | 160       | 10.7 s   | 0      | 77.6     | 143.8    | 170.0    | 218.6    | 77.3           | 143.7          | 169.7          | 218.5          |
| Database in memory (`:memory:`)                     | 156       | 10.9 s   | 0      | 77.2     | 144.8    | 175.9    | 247.4    | 76.9           | 144.6          | 175.6          | 245.9          |
| Split, rollback journal                             | 80        | 21.2 s   | 0      | 141.0    | 287.8    | 9141.9   | 10689.3  | 142.2          | 288.0          | 9143.4         | 10691.0        |
| Split, rollback journal                             | 81        | 21.1 s   | 0      | 137.8    | 278.6    | 9235.3   | 10820.0  | 138.8          | 279.7          | 9236.8         | 10821.7        |
| Split, rollback journal                             | 83        | 20.5 s   | 0      | 137.6    | 286.4    | 8913.5   | 10478.6  | 138.4          | 287.2          | 8915.3         | 10480.1        |
| Split, WAL `NORMAL`                                 | 147       | 11.5 s   | 0      | 81.6     | 105.9    | 121.5    | 174.8    | 82.6           | 107.0          | 125.0          | 175.7          |
| Split, WAL `NORMAL`                                 | 149       | 11.4 s   | 0      | 80.1     | 98.7     | 111.1    | 7036.0   | 81.2           | 100.2          | 111.7          | 7037.2         |
| Split, WAL `NORMAL`                                 | 149       | 11.4 s   | 0      | 79.6     | 98.5     | 120.5    | 6893.5   | 80.8           | 100.0          | 121.9          | 6894.8         |
| Split, WAL `NORMAL`, shared transactions for writes | 167       | 10.2 s   | 0      | 70.1     | 85.8     | 97.6     | 3829.8   | 71.4           | 87.2           | 98.8           | 3830.4         |
| Split, WAL `NORMAL`, shared transactions for writes | 169       | 10.1 s   | 0      | 69.9     | 86.1     | 98.8     | 5010.0   | 71.0           | 87.4           | 99.8           | 5011.4         |
| Split, WAL `NORMAL`, shared transactions for writes | 172       | 9.9 s    | 0      | 70.3     | 82.1     | 94.0     | 2517.4   | 71.4           | 83.1           | 94.8           | 2518.7         |

**CPU profiles,** one run each with `--profile`, own time by package as reported by `npm run perf:profile`:

| Configuration                            | Sampled | Top packages by own time                                                                                                               |
| ---------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| As 0.6.0                                 | 19.7 s  | kysely 30.5%, @mikro-orm/core 16.2%, rfc6902 12.0%, @mikro-orm/sql 10.0%, better-sqlite3 6.9%, node 5.1%, remote-state 2.6%, idle 2.1% |
| WAL `NORMAL`, state cache                | 12.5 s  | rfc6902 19.0%, @mikro-orm/core 17.8%, @mikro-orm/sql 10.2%, kysely 10.1%, node 9.5%, better-sqlite3 8.9%, remote-state 3.4%, idle 1.8% |
| Database in memory                       | 12.5 s  | @mikro-orm/core 21.8%, rfc6902 17.2%, @mikro-orm/sql 11.0%, better-sqlite3 10.2%, node 9.8%, kysely 5.4%, remote-state 4.3%, idle 1.7% |
| Split, WAL `NORMAL`, shared transactions | 11.4 s  | rfc6902 20.0%, @mikro-orm/core 17.7%, kysely 11.8%, node 9.9%, @mikro-orm/sql 9.4%, better-sqlite3 7.0%, remote-state 4.3%, idle 2.6%  |

In the 0.6.0 profile, committing transactions took 17% including calls; in the split profile, `toJson` took 2.4% own time and `structuredClone` 1.5%. A battleship state in these runs was at most 1,269 bytes of JSON, 1,164 on average.

## 2026-10-04, version 0.6.0

Same environment and scenario as for version 0.4.2, below.

| Command                      | Actions | Duration | Actions/s | Errors | HTTP p50 | HTTP p95 | HTTP p99 | HTTP max | End-to-end p50 | End-to-end p95 | End-to-end p99 | End-to-end max |
| ---------------------------- | ------- | -------- | --------- | ------ | -------- | -------- | -------- | -------- | -------------- | -------------- | -------------- | -------------- |
| `--games 1`                  | 17      | 0.4 s    | 48        | 0      | 10.4     | 15.7     | 15.7     | 15.7     | 9.8            | 14.9           | 14.9           | 14.9           |
| `--games 100`                | 1700    | 17.6 s   | 97        | 0      | 85.9     | 3345.2   | 8022.1   | 9525.2   | 85.4           | 3344.9         | 8021.5         | 9524.9         |
| `--games 100 --format immer` | 1700    | 16.7 s   | 102       | 0      | 81.7     | 3505.2   | 8084.0   | 9118.7   | 81.4           | 3504.8         | 8083.8         | 9118.4         |
| `--games 100 --pause 500`    | 1700    | 17.8 s   | 96        | 0      | 154.3    | 364.3    | 1108.2   | 2212.9   | 154.0          | 364.0          | 1107.9         | 2212.2         |
| `--games 100 --pause 2000`   | 1700    | 44.5 s   | 38        | 0      | 12.4     | 22.6     | 32.7     | 72.0     | 12.1           | 22.3           | 32.2           | 71.7           |

Each command was run once, as for version 0.4.2.

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
