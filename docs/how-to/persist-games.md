# Persist games across restarts

By default, games live in an in-memory SQLite database and are lost when the process stops, along with every player and token. To keep them, store them in a file:

```ts
const server = await createRemoteStateServer(myGame, {
  database: "/var/lib/my-game/games.db", // relative paths start from the working directory
});
```

`createRemoteState` takes the same option. When one process serves several games, give each its own file; the database doesn't record which game a stored game belongs to.

The directory must already exist. The tables are created on first start.

## What a restart keeps

After a restart on the same file, everything stored carries on: games and their history, players, tokens, and admission codes that haven't expired. Sequences continue where they stopped, and clients can catch up with `GET …/updates` from before the restart.

Stop the server with `close()`. Connected clients see a lost connection and reconnect by themselves once the server is back, and get the latest view on connect. Pending timers are lost, though ([0042](../explanation/decisions/0042-timer-restarts-open.md)). A game with timers pauses itself in its plugin's `onRestart`, and waits to be resumed; see [Pause on a restart](schedule-actions.md#pause-on-a-restart).

## After changing your state type

Stored states are used as-is. If you change the shape of `StateType`, games saved before the change will reach your plugin's functions in the old shape. That includes `filterStateForAudience`, which also runs on old states when a client catches up. Either handle both shapes, or delete the database file.

## After upgrading the library

Before 1.0, databases aren't upgraded ([0048](../explanation/decisions/0048-no-database-upgrades-before-1-0.md)). If the new version's schema differs, the server refuses to start with an `UnsupportedDatabaseError`, which says so. Delete the file, and with it every stored game, player and token, or go back to the version that created it.

To start over automatically, catch the error and delete the file:

```ts
import { rmSync } from "fs";
import { UnsupportedDatabaseError } from "@malte.muth/remote-state";

const start = () => createRemoteStateServer(myGame, { database });
const server = await start().catch((err) => {
  if (!(err instanceof UnsupportedDatabaseError)) throw err;
  rmSync(database);
  return start();
});
```

## Back up

The database is a single SQLite file. Copy it while the server is stopped, or use `sqlite3 games.db ".backup backup.db"` while it runs.

The file holds every full state and action, including hidden information, so protect backups like the live file. Tokens and admission codes are stored only as hashes.
