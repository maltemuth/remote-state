# <img src="icon.svg" alt="" width="40" height="40" align="top"> Remote State documentation

Organized by what you're doing, following [Diátaxis](https://diataxis.fr/). Coding agents: [llms.txt](../packages/remote-state/llms.txt) has the whole library in one file.

**Learn:** [Build your first game](tutorials/build-your-first-game.md)

**Do:**

- [Create spaces and admit members](how-to/admit-members.md), and pair devices
- [Connect a client](how-to/connect-a-client.md)
- [Embed in an existing app](how-to/embed-in-an-existing-app.md)
- [Hide information from members](how-to/hide-information.md)
- [Schedule actions and time limits](how-to/schedule-actions.md)
- [Persist spaces across restarts](how-to/persist-spaces.md)
- [Test your rules](how-to/test-your-rules.md)
- [Maintain the library](how-to/maintain.md): releases and performance

**Look up:** [Rules](reference/rules.md) · [Server API](reference/server-api.md) · [Client API](reference/client-api.md) · [HTTP API](reference/http-api.md) · [Socket.IO events](reference/socket-events.md) · [Performance measurements](reference/performance.md)

**Understand:** [Goals](explanation/goals.md) · [Architecture](explanation/architecture.md) · [Known limitations](explanation/limitations.md) · [Decisions](explanation/decisions/README.md) · [Designs](explanation/designs/README.md)

## Writing documentation

- **One type per page:** tutorial (`tutorials/`), how-to (`how-to/`), reference (`reference/`) or explanation (`explanation/`).
- **Open questions** go in `explanation/designs/`, **settled ones** in a decision record in `explanation/decisions/`. Records aren't rewritten; a new one supersedes them.
- **When behaviour changes,** update the reference and how-to pages in the same change, and `llms.txt`.
- **Planned work** goes in [BACKLOG.md](../BACKLOG.md), not here.
