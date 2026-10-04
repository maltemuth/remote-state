# 0045. The client is generic over the game's types

Status: Accepted
Date: 2026-10-04

## Context

A game's view and action types are the contract between its server and its clients ([Goals](../goals.md)). The server's `GamePlugin` is already generic over them.

## Decision

The client takes the game's view and action types as type parameters, for example `createClient<TicTacToeView, TicTacToeAction>(…)`. The game exports its types, and both sides import them. The client doesn't check at runtime that what the server sends matches the types.

## Alternatives considered

- **Generating client types from the server.** Needs a build step, and the types already exist as TypeScript.
- **Validating messages at runtime,** with a schema. Adds a dependency and a schema to keep in step with the types, for data from the game's own server.

## Consequences

- A game's types have to live where clients can import them without importing the server, for example in a module with only types.
- Plain JavaScript clients use the client without type parameters.
