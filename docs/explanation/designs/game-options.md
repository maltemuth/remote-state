# Game options

Status: Decided in [0036](../decisions/0036-hosts-pass-the-initial-state.md)

## Outcome

The library has no concept of game options. The host gets an initial state from the game, with whatever settings the game offers, and passes it to `createGame` ([0036](../decisions/0036-hosts-pass-the-initial-state.md)). Options a game has are part of its state: whether players see them is up to its view filter and audiences, and whether they change is up to its rules. The questions below are answered by that.

## Problem

`getInitialState()` takes no arguments. A game can't be created with settings such as board size, number of rounds or a rules variant, and the initial state can't depend on who created the game. `POST /api/games` accepts only a game name and the creator's name.

The only workaround today is a configuration action sent after creation, which needs its own validation and leaves the game briefly in an unconfigured state.

## Constraints

- Options come from clients, so they must be validated like actions.
- Adding an argument to `getInitialState` is backwards compatible for games that ignore it. Changing the plugin's type parameters isn't.

## Options

### A. Options passed to `getInitialState`

`POST /api/games` accepts an `options` object, and the library calls `getInitialState(options, creator)`. The plugin validates the options, either in a new `validateOptions` function or by rejecting them from `getInitialState` with a message.

- Simple, and it creates the game fully configured in one step.
- It adds a type parameter for the options to `GamePlugin`, and every server must decide how to report invalid options.

### B. A configuration action

Keep `getInitialState()` as is, and document a pattern: the creator's first action configures the game.

- No library change.
- Every game must model an unconfigured phase, and the options are mixed into the action history.

### C. A declared options schema

The plugin declares its options as a schema, for example JSON Schema. The library validates options against it, and clients can read the schema to build a settings form.

- Validation and client forms come for free.
- It adds a schema format to the library's interface and to its dependencies.

## Open questions

- Can options change after the game has started, for example between rounds?
- Should options be visible to all players, and should they pass through `filterStateForPlayer`?
- Does [Player information](player-information.md) option A or B already cover the creator part?
