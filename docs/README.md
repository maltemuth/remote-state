# Remote State documentation

All documentation for this project, including designs and decisions, is organized by what the reader is trying to do, following [Diátaxis](https://diataxis.fr/).

## Tutorials: learn by building

- [Build your first game: rock, paper, scissors](tutorials/build-your-first-game.md)

## How-to guides: get a specific task done

- [Create games and admit players](how-to/admit-players.md)
- [Pair another device](how-to/pair-another-device.md)
- [Connect a browser client](how-to/connect-a-client.md)
- [Serve a web client from the game server](how-to/serve-a-web-client.md)
- [Embed in an existing app](how-to/embed-in-an-existing-app.md), also with several games on one server
- [Hide information from players](how-to/hide-information-from-players.md)
- [Schedule actions and time limits](how-to/schedule-actions.md), such as a turn timeout
- [Persist games across restarts](how-to/persist-games.md)
- [Test a game plugin](how-to/test-a-game-plugin.md)
- [Measure performance](how-to/measure-performance.md)
- [Publish a release](how-to/publish-a-release.md) (for maintainers)

## Reference: look up exact behavior

- [GamePlugin](reference/game-plugin.md): the interface a game implements
- [HTTP API](reference/http-api.md)
- [Socket.IO events](reference/socket-events.md)
- [Client API](reference/client-api.md): `@malte.muth/remote-state-client`, for browsers and Node.js
- [Performance measurements](reference/performance.md): load test results, as measured
- [Server API](reference/server-api.md): `createRemoteStateServer`, `createRemoteState`, options, logging, database schema

## Explanation: understand the design

- [Goals](explanation/goals.md): what the library is for
- [Architecture](explanation/architecture.md): the life of an action, state history, identity, hidden information
- [Known limitations](explanation/limitations.md)
- [Decisions](explanation/decisions/README.md): what was decided, and why
- [Designs](explanation/designs/README.md): proposals, such as the game lifecycle and timers, and the outcome of decided ones

## Writing documentation

Before writing, decide which of the four types the page is, and keep it to that type. A page that mixes types serves no reader well. For example, a decision record shouldn't contain setup steps; link to a how-to guide instead.

| The reader wants to…                                  | Type         | Folder         |
| ----------------------------------------------------- | ------------ | -------------- |
| learn by doing, guided step by step                   | Tutorial     | `tutorials/`   |
| complete a specific task they already understand      | How-to guide | `how-to/`      |
| look up exact behavior: APIs, events, options, schema | Reference    | `reference/`   |
| understand how something works or why it is that way  | Explanation  | `explanation/` |

Designs and decisions are explanation: they discuss context, alternatives and trade-offs.

- **Design proposals** go in [`explanation/designs/`](explanation/designs/README.md). A proposal describes a problem and the options for solving it, while it's still open.
- **Decision records** go in [`explanation/decisions/`](explanation/decisions/README.md). A decision record states what was decided, why, and what was rejected. Write one whenever a design discussion settles something, and link it from the proposal.
- **When a decision changes behavior,** update the affected reference and how-to pages in the same change. Decision records explain _why_; the other types describe _what is_.

Work still to be done isn't documentation, so it's tracked outside `docs/`, in [BACKLOG.md](../BACKLOG.md).
