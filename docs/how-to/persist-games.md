# Persist games across restarts

By default, games live in an in-memory SQLite database and are lost when the process stops, along with every player and token. To keep them, store them in a file:

```ts
const server = await createRemoteStateServer(myGame, {
  database: "/var/lib/my-game/games.db", // relative paths start from the working directory
});
```

`createRemoteState` takes the same option. When one process serves several games, give each its own file; the database doesn't record which game a stored game belongs to.

The directory must already exist. The tables are created by migrations on first start.

## What a restart keeps

After a restart on the same file, everything stored carries on: games and their history, players, tokens, and admission codes that haven't expired. Sequences continue where they stopped, and clients can catch up with `GET …/updates` from before the restart.

Stop the server with `close()`. Connected clients see a lost connection and reconnect by themselves once the server is back, and get the latest view on connect. Pending timers are lost, though: a game waiting for a timeout waits until something else happens in it ([0042](../explanation/decisions/0042-timer-restarts-open.md)).

## After changing your state type

Stored states are used as-is. If you change the shape of `StateType`, games saved before the change will reach your plugin's functions in the old shape. That includes `filterStateForAudience`, which also runs on old states when a client catches up. Either handle both shapes, or delete the database file.

## After upgrading the library

Schema changes ship as migrations and are applied automatically on startup, so existing database files keep working. Back up the file before upgrading. Migrations only move forward; there is no automatic downgrade.

Databases created by version 0.2.0 or earlier have a different schema and can't be migrated. Delete them.

## Back up

The database is a single SQLite file. Copy it while the server is stopped, or use `sqlite3 games.db ".backup backup.db"` while it runs.

The file holds every full state and action, including hidden information, so protect backups like the live file. Tokens and admission codes are stored only as hashes.
