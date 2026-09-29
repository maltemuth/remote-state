# Remote State documentation

All documentation for this project, including designs and decisions, is organized by what the reader is trying to do, following [Diátaxis](https://diataxis.fr/).

## Tutorials: learn by building

- [Build your first game: rock, paper, scissors](tutorials/build-your-first-game.md)

## How-to guides: get a specific task done

- [Connect a browser client](how-to/connect-a-client.md)
- [Serve a web client from the game server](how-to/serve-a-web-client.md)
- [Hide information from players](how-to/hide-information-from-players.md)
- [Persist games across restarts](how-to/persist-games.md)
- [Test a game plugin](how-to/test-a-game-plugin.md)
- [Publish a release](how-to/publish-a-release.md) (for maintainers)

## Reference: look up exact behavior

- [GamePlugin](reference/game-plugin.md): the interface a game implements
- [HTTP API](reference/http-api.md)
- [Socket.IO events](reference/socket-events.md)
- [Server API](reference/server-api.md): `createRemoteStateServer`, configuration, logging, database schema

## Explanation: understand the design

- [Goals](explanation/goals.md): what the library is for
- [Architecture](explanation/architecture.md): the life of an action, state history, identity, hidden information
- [Known limitations](explanation/limitations.md)
- [Decisions](explanation/decisions/README.md): what was decided, and why
- [Designs](explanation/designs/README.md): proposals under discussion, such as player information, game options, lifecycle and timers

## Writing documentation

Before writing, decide which of the four types the page is, and keep it to that type. A page that mixes types serves no reader well. For example, a decision record shouldn't contain setup steps; link to a how-to guide instead.

| The reader wants to… | Type | Folder |
|---|---|---|
| learn by doing, guided step by step | Tutorial | `tutorials/` |
| complete a specific task they already understand | How-to guide | `how-to/` |
| look up exact behavior: APIs, events, options, schema | Reference | `reference/` |
| understand how something works or why it is that way | Explanation | `explanation/` |

Designs and decisions are explanation: they discuss context, alternatives and trade-offs.

- **Design proposals** go in [`explanation/designs/`](explanation/designs/README.md). A proposal describes a problem and the options for solving it, while it's still open.
- **Decision records** go in [`explanation/decisions/`](explanation/decisions/README.md). A decision record states what was decided, why, and what was rejected. Write one whenever a design discussion settles something, and link it from the proposal.
- **When a decision changes behavior,** update the affected reference and how-to pages in the same change. Decision records explain *why*; the other types describe *what is*.

Work still to be done isn't documentation, so it's tracked outside `docs/`, in [BACKLOG.md](../BACKLOG.md).
