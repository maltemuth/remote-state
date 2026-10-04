# 0046. Reserved keys in states are documented, not handled

Status: Superseded by [0047](0047-reserved-keys-dropped-with-warning.md)
Date: 2026-10-04

## Context

Hostile-input tests showed that states may contain keys named `__proto__`, `constructor` or `prototype`, for example when a game uses names that players choose as keys. The server stores and sends them as plain data, and `Object.prototype` stays untouched. Clients that apply the server's patches with Immer ([0014](0014-immer-patches-only-external-format.md)) don't:

- A patch whose value contains an own `__proto__` key loses that key when applied, so the client's view silently differs from the server's.
- Immer refuses to apply a patch whose path goes through `__proto__` or `constructor`, and throws.

## Decision

The library doesn't handle reserved keys. Games that use keys players choose should avoid them, for example by prefixing keys or using arrays of entries. The behavior is documented in the GamePlugin reference, the patch format and the known limitations.

## Alternatives considered

- **Sending a whole view instead of patches** when an update's patches touch a reserved key, and redirecting `GET …/updates` to the state. Keeps every client correct without restricting games, at the cost of scanning every update's patches.
- **Rejecting states that contain `__proto__`,** like other invalid results of a game. Restricts games, and doesn't cover `constructor`.

## Consequences

- With whole views (`format=state`), reserved keys arrive intact.
- The client package recovers from patches that Immer refuses by fetching the whole state, but not from a lost `__proto__` key.
- Either alternative can be added later without changing the API.
