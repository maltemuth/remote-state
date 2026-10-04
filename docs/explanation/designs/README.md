# Designs

Proposals for open design questions. A proposal explains a problem and the options for solving it, so the decision can be made with the trade-offs in view. Once decided, the outcome is recorded in [decisions](../decisions/README.md), and the proposal links to that record.

| Proposal | About | Status |
|---|---|---|
| [State synchronization](state-synchronization.md) | How clients keep their copy of the state in step with the server | Open |
| [Authorization](authorization.md) | Who may create, join and act in games, and how they prove it | Decided; limiting tokens deferred |
| [Audiences](audiences.md) | Views shared by groups of participants, such as spectators | Open |
| [Player information](player-information.md) | Letting game logic see who has registered | Decided |
| [Game options](game-options.md) | Creating a game with settings | Decided |
| [Game lifecycle](game-lifecycle.md) | Joining, leaving, disconnecting, and the end of a game | Open |
| [Server-initiated actions](server-initiated-actions.md) | Timers, computer players, scheduled events | Mostly decided; restarts open |
| [Client package](client-package.md) | A library for game clients | Deferred |

Further open questions are listed in [Known limitations](../limitations.md).

## Writing a proposal

Create `designs/<short-topic>.md`:

```markdown
# <Topic>

Status: Open | Deferred until … | Decided in [NNNN](../decisions/NNNN-title.md) | Abandoned

## Problem

What doesn't work today, or what we want to be possible, and for whom.

## Constraints

Requirements and limits any solution must respect.

## Options

### <Option A>

How it would work, and its consequences: benefits, costs, risks.

### <Option B>

…

## Open questions

What must be answered before deciding.
```

A proposal stays explanation. It describes and compares, but doesn't include implementation steps or API reference; those belong in how-to and reference pages once the design is built.
