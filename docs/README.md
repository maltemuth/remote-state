# Remote State documentation

The documentation is organized by what you're trying to do, following [Diátaxis](https://diataxis.fr/).

## Tutorials: learn by building

- [Build your first game: rock, paper, scissors](tutorials/build-your-first-game.md)

## How-to guides: get a specific task done

- [Connect a browser client](how-to/connect-a-client.md)
- [Serve a web client from the game server](how-to/serve-a-web-client.md)
- [Hide information from players](how-to/hide-information-from-players.md)
- [Persist games across restarts](how-to/persist-games.md)
- [Test a game plugin](how-to/test-a-game-plugin.md)

## Reference: look up exact behavior

- [GamePlugin](reference/game-plugin.md): the interface a game implements
- [HTTP API](reference/http-api.md)
- [Socket.IO events](reference/socket-events.md)
- [Server API](reference/server-api.md): `createRemoteStateServer`, configuration, logging, database schema

## Explanation: understand the design

- [Architecture](explanation/architecture.md): the life of an action, state history, identity, hidden information
- [Known limitations](explanation/limitations.md)
