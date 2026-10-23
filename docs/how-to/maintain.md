# Maintain the library

For maintainers: publishing a release, and measuring performance.

## Publish a release

`@malte.muth/remote-state` and `@malte.muth/remote-state-client` are released together, with the same version. Neither has been published yet.

1. **Start clean:**

   ```sh
   git switch master && git pull
   nvm use
   npm ci --ignore-scripts   # otherwise npm builds the SQLite driver from source (0064)
   ```

2. **Run every check:** `npm run build`, `npm test`, `npm run lint`, and `npm audit`, which must find 0 vulnerabilities ([0003](../explanation/decisions/0003-no-known-vulnerabilities.md)).

3. **Check what's packed:** `npm pack --dry-run -w packages/remote-state -w packages/remote-state-client`. Each must hold only `package.json`, `README.md`, `LICENSE` and `dist/`, plus `llms.txt` in the server package. `prepack` rebuilds `dist/` from scratch.

4. **Try the packages as a user would,** outside the repository:

   ```sh
   npm pack -w packages/remote-state -w packages/remote-state-client --pack-destination /tmp
   mkdir /tmp/remote-state-check && cd /tmp/remote-state-check
   npm init -y && npm install /tmp/malte.muth-remote-state-*.tgz
   node --input-type=module -e "import { createRemoteStateServer } from '@malte.muth/remote-state'; console.log(typeof createRemoteStateServer)"
   node -e "console.log(typeof require('@malte.muth/remote-state').createRemoteStateServer)"
   node --input-type=module -e "import { createClient } from '@malte.muth/remote-state-client'; console.log(typeof createClient)"
   ```

   Each must print `function`.

5. **Version it:**
   - If the entities' tables changed, raise `SCHEMA_VERSION` in `packages/remote-state/src/database/orm.ts`, and say in the changelog that databases must be deleted.
   - In `CHANGELOG.md`, rename `## Unreleased` to `## <version> - <date>`, with a new empty `## Unreleased` above.
   - Set the version in the root, library, client and example `package.json`; before 1.0, breaking changes raise the minor version.
   - Run `npm install --ignore-scripts`, then `git commit -am "Release <version>"` and `git tag -a v<version> -m "<version>"`.

6. **Publish:** `npm publish -w packages/remote-state -w packages/remote-state-client`, then `git push && git push --tags`.

## Measure performance

The load test plays battleship games against the example server, and measures each action until its HTTP response and until the other player's socket has the update. Results are kept in [Performance measurements](../reference/performance.md).

```sh
npm run perf -- --games 100 --pause 2000
```

It builds, starts the server in its own process with temporary databases, plays, stops, and prints a report:

```text
100 battleship games at once, 43 actions each, pause 2000 ms, format state, diff positional, checksums off, parser json, deflate off
  4300 actions in 105.6 s = 41 actions/s, 0 errors
  received:       5078 bytes per action, by both players
  CPU per action: 1.20 ms server, 0.40 ms load test
  HTTP response:  p50 25.5  p95 124.0  p99 285.7  max 1640.5 ms
  end to end:     p50 25.2  p95 123.8  p99 285.3  max 1640.2 ms
```

| Option        | Default      | Meaning                                                                                       |
| ------------- | ------------ | --------------------------------------------------------------------------------------------- |
| `--games`     | `100`        | Games at once                                                                                 |
| `--pause`     | `0`          | Average ms before each action, ±50%; `0` measures throughput                                  |
| `--format`    | `state`      | `state` or `immer`                                                                            |
| `--diff`      | `positional` | `positional` or `rfc6902`; only with `--format immer`                                         |
| `--checksums` | off          | Send and check checksums; off by default, unlike the library, to compare with earlier results |
| `--parser`    | `json`       | `json` or `msgpack`                                                                           |
| `--deflate`   | off          | Compress messages of at least this many bytes                                                 |
| `--runs`      | `1`          | Repeat against a fresh server each time                                                       |
| `--profile`   |              | Directory for a CPU profile per run; not with `--url`                                         |
| `--url`       |              | Test a running server instead                                                                 |
| `--port`      | `3999`       | Port of the server it starts                                                                  |
| `--max-p95`   |              | Exit with 1 when an end-to-end p95 exceeds this many ms                                       |

A run also fails when any action fails. Environment variables pass on to the server.

To see where the server's time goes, `npm run perf:profile -- profiles/<file>.cpuprofile` summarizes a profile by package and function; `--top` sets the length of each list. Profiling slows the server, so measure without it. Results depend on the machine, and the client shares it with the server: compare runs on one machine only.
