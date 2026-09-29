# Persist games across restarts

By default, games live in an in-memory SQLite database and are lost when the process stops. To keep them, store them in a file:

```ts
const server = await createRemoteStateServer(
  {
    ...myGame,
    serverConfiguration: {
      persistDatabase: true,
      databaseFilename: "/var/lib/my-game/games.db", // default: games.db in the working directory
    },
  },
  3000
);
```

The directory must already exist. Tables are created on first start.

## After changing your state type

Stored states are replayed as-is. If you change the shape of `StateType`, games saved before the change will reach `validateAction` and `executeAction` in the old shape. Either handle both shapes, or delete the database file.

## After upgrading the library

The library creates missing tables but never alters existing ones. If a release changes the schema, delete the database file, or migrate it by hand.

Databases created before commit `ed5d7aa` have unusable state ordering and constraints. They can't be migrated; delete them.

## Back up

The database is a single SQLite file. Copy it while the server is stopped, or use `sqlite3 games.db ".backup backup.db"` while it runs.
