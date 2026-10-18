# Measure performance

The repository has a load test. Past results are recorded in [Performance measurements](../reference/performance.md).

The load test plays many battleship games at once against the example server, and measures how long each action takes, until its HTTP response and until the other player's socket receives the update.

## Run it

From the repository root:

```sh
nvm use
npm run perf -- --games 100 --pause 2000
```

It builds both packages, starts the example server in its own process with its databases in a temporary directory, plays the games, stops the server and prints a report. Players keep their views as clients do, applying patches and checking checksums. The report counts the bytes their sockets received, on the wire, and the CPU time of the server and of the load test itself, per action:

```text
100 battleship games at once, 43 actions each, pause 2000 ms, format state, diff positional, checksums off, parser json, deflate off
  4300 actions in 105.6 s = 41 actions/s, 0 errors
  received:       5078 bytes per action, by both players
  CPU per action: 1.20 ms server, 0.40 ms load test
  HTTP response:  p50 25.5  p95 124.0  p99 285.7  max 1640.5 ms
  end to end:     p50 25.2  p95 123.8  p99 285.3  max 1640.2 ms
```

Each game has two players on the classic 10×10 board. Both place their five ships, then player 1 sinks player 2's fleet while player 2 misses: 43 actions. Results recorded before 2026-10-05 come from a smaller game, 5×5 with two ships and 17 actions, and can't be compared with later ones.

## Options

| Option        | Default      | Meaning                                                                                                                                                                                                                        |
| ------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--games`     | `100`        | Games played at the same time                                                                                                                                                                                                  |
| `--pause`     | `0`          | Average milliseconds a player waits before each action, randomized by ±50%. `0` sends actions as fast as the server answers.                                                                                                   |
| `--checksums` | off          | The started server sends checksums, and the players check them; a mismatch counts as an error. Without it, the server runs with `checksums: false`, unlike the library's default, so results stay comparable with earlier ones |
| `--parser`    | `json`       | Socket.IO's parser on both ends: `json` or `msgpack`                                                                                                                                                                           |
| `--deflate`   | off          | Compress messages of at least this many bytes, such as `--deflate 0`                                                                                                                                                           |
| `--diff`      | `positional` | How the started server computes patches: `positional` or `rfc6902`; only matters with `--format immer`                                                                                                                         |
| `--format`    | `state`      | What the socket sends: `state` or `immer`                                                                                                                                                                                      |
| `--runs`      | `1`          | Repeat the run this many times, each against a freshly started server, and report each run                                                                                                                                     |
| `--profile`   |              | Directory where each started server writes a CPU profile when it stops; not with `--url`                                                                                                                                       |
| `--url`       |              | Test a server that's already running, instead of starting one                                                                                                                                                                  |
| `--port`      | `3999`       | Port for the server it starts                                                                                                                                                                                                  |
| `--max-p95`   |              | Fail with exit code 1 when any run's end-to-end p95, in milliseconds, exceeds this                                                                                                                                             |

The run also fails when any action fails.

Environment variables are passed on to the server it starts, so a run can switch settings of the server.

## Profile the server

```sh
npm run perf -- --games 100 --profile profiles
npm run perf:profile -- profiles/CPU.20261004.174039.47726.0.001.cpuprofile
```

The first command writes a `.cpuprofile` file per run into `profiles`. The second prints where the server's sampled time went: by package, by function, and by function including everything it called. `--top` sets how many lines each list shows, 25 by default. Chrome DevTools and VS Code also open `.cpuprofile` files, as flame graphs.

Profiling slows the server down, so measure throughput and latency without `--profile`.

## Read the results

- **End to end** is the time from sending an action until the other player's socket receives the update. It's usually a little shorter than the HTTP response, because the server sends updates before it answers the request.
- **The pause decides the load.** With 100 games and a 2-second pause, players send about 50 actions per second. With no pause, they send as many as the server can handle, so the run measures throughput, and latency mostly shows how long actions wait for each other.
- **Results depend on the machine,** and the client runs on the same machine as the server. Compare runs on the same machine, not with numbers from elsewhere.
