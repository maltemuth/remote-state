# <img src="docs/icon.svg" alt="" width="40" height="40" align="top"> Remote State

> ⚠️ **Experimental, and vibe-coded.** Written largely with an AI assistant, and not reviewed for production use. Use at your own risk.

Like Redux, Pinia or NgRx, but the store lives on the server and every user is connected to it.

Clients dispatch actions. The server runs your rules, like a reducer, and sends each user the new state.

![Alice and Bob each send actions to the server. Your rules turn the current state and an action into the new state; your filter turns the state into each user's own view, which goes back to that user.](docs/how-it-works.svg)

The full state never leaves the server. A client only ever receives what your filter lets its user see, so anything private, such as a sealed bid, a hand of cards or someone else's draft, stays hidden, even from the browser's dev tools. And clients can't change the state themselves: an action your rules reject changes nothing, its sender gets the reason, and nobody else sees a thing.

```ts
// On the server: your rules, for a round of rock, paper, scissors
const rules: Rules<State, Action, View> = {
  validateAction: (state, action, memberId) =>
    state.choices[memberId] ? "You already chose" : true,
  executeAction: (state, action, memberId) => ({
    ...state,
    choices: { ...state.choices, [memberId]: action.choice },
  }),
  // Your own choice, and only how many have chosen
  view: (state, memberId) => ({
    mine: state.choices[memberId] ?? null,
    chosen: Object.keys(state.choices).length,
  }),
};

// In the browser: dispatch actions, and subscribe to your own view
await client.dispatch({ type: "choose", choice: "rock" });
client.subscribe(({ view }) => render(view));
```

Each shared state is a **space**, and the people in it are its **members**. The library does the rest: storing every space with its history, ordering actions, catching clients up after they reconnect, timers, and leaving it to your app who may join.

## Try it

Node.js 24 or newer (`nvm use`):

```sh
npm install --ignore-scripts   # skips npm's needless, failing build of the SQLite driver
npm run start:example          # tic-tac-toe on http://localhost:3000
npm test
```

Then build your own game in the [tutorial](docs/tutorials/build-your-first-game.md).

## Where things are

- [packages/remote-state](packages/remote-state): the server library
- [packages/remote-state-client](packages/remote-state-client): the client
- [packages/remote-state-example-server](packages/remote-state-example-server): tic-tac-toe and battleship, each with a lobby
- [docs](docs/README.md): documentation; [llms.txt](packages/remote-state/llms.txt) for coding agents
- [BACKLOG.md](BACKLOG.md): planned work
