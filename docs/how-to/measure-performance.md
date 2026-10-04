# Measure performance

The repository has a load test. Past results are recorded in [Performance measurements](../reference/performance.md).

The load test plays many battleship games at once against the example server, and measures how long each action takes, until its HTTP response and until the other player's socket receives the update.

## Run it

From the repository root:

```sh
nvm use
npm run perf -- --games 100 --pause 2000
```

It builds both packages, starts the example server in its own process with its databases in a temporary directory, plays the games, stops the server and prints a report:

```text
100 battleship games at once, 17 actions each, pause 2000 ms, format state
  1700 actions in 44.4 s = 38 actions/s, 0 errors
  HTTP response:  p50 12.8  p95 29.1  p99 87.2  max 159.3 ms
  end to end:     p50 12.4  p95 28.8  p99 86.9  max 158.9 ms
```

Each game has two players, who place their fleets and fire until one fleet is sunk: 17 actions.

## Options

| Option      | Default | Meaning                                                                                                                      |
| ----------- | ------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `--games`   | `100`   | Games played at the same time                                                                                                |
| `--pause`   | `0`     | Average milliseconds a player waits before each action, randomized by ±50%. `0` sends actions as fast as the server answers. |
| `--format`  | `state` | What the socket sends: `state` or `immer`                                                                                    |
| `--url`     |         | Test a server that's already running, instead of starting one                                                                |
| `--port`    | `3999`  | Port for the server it starts                                                                                                |
| `--max-p95` |         | Fail with exit code 1 when the end-to-end p95, in milliseconds, exceeds this                                                 |

The run also fails when any action fails.

## Read the results

- **End to end** is the time from sending an action until the other player's socket receives the update. It's usually a little shorter than the HTTP response, because the server sends updates before it answers the request.
- **The pause decides the load.** With 100 games and a 2-second pause, players send about 50 actions per second. With no pause, they send as many as the server can handle, so the run measures throughput, and latency mostly shows how long actions wait for each other.
- **Results depend on the machine,** and the client runs on the same machine as the server. Compare runs on the same machine, not with numbers from elsewhere.
