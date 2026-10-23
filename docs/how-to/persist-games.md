# Persist games across restarts

Games live in an in-memory database unless you give a file. Its directory must exist; the tables are created on first start:

```ts
const server = await createRemoteStateServer(myGame, {
  database: "/var/lib/my-game/games.db",
});
```

With several games in one process, give each its own file.

## What a restart keeps

Everything stored: games and their history, players, tokens and unexpired codes. Clients reconnect by themselves and get the latest view. A crash loses nothing stored; a power loss may lose the last actions, but leaves every game consistent ([0054](../explanation/decisions/0054-wal-without-syncing-every-commit.md)).

Pending timers are lost. Handle that in `onRestart`: see [Pause on a restart](schedule-actions.md#pause-on-a-restart).

## After changing your state type

Stored states reach your plugin as they were saved, including in `filterStateForAudience` when a client catches up. Handle both shapes, or delete the file.

## After upgrading the library

Databases aren't upgraded before 1.0 ([0048](../explanation/decisions/0048-no-database-upgrades-before-1-0.md)). A file from another schema version makes the server refuse to start with `UnsupportedDatabaseError`: delete it, or go back to the version that made it. To start over automatically:

```ts
const start = () => createRemoteStateServer(myGame, { database });
const server = await start().catch((err) => {
  if (!(err instanceof UnsupportedDatabaseError)) throw err;
  rmSync(database);
  return start();
});
```

## Back up

Copy `games.db`, `games.db-wal` and `games.db-shm` while the server is stopped, or run `sqlite3 games.db ".backup backup.db"` while it runs. Protect backups like the live file: they hold every full state, hidden information included.
