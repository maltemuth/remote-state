# 0060. The socket's parser and compression are deployment options

Status: Accepted
Date: 2026-10-18

## Context

Every update is JSON over a WebSocket, uncompressed. Whole views repeat almost everything from one update to the next, and patches repeat their keys. Socket.IO can replace its JSON parser, for example with MessagePack, and WebSocket can compress messages with permessage-deflate. Which is worth it depends on the game and on where its players are: bytes matter on mobile networks, CPU matters on a busy server.

## Decision

- **`socket.parser` passes a Socket.IO parser through,** such as `socket.io-msgpack-parser`. Clients must use the same one; the client package takes it as its `parser` option. The library doesn't depend on any parser.
- **`socket.perMessageDeflate` passes WebSocket compression through,** off by default as in Socket.IO. Browsers and the Node.js client negotiate it by themselves. Its `threshold` sets the smallest message compressed, 1024 bytes by default.

## Alternatives considered

- **Choosing a parser by name, with MessagePack built in.** Adds a dependency to every client and server for an option few need.
- **Compression always on.** Costs every server CPU, and every connection memory for its compression context.

## Consequences

Measured on a Windows desktop with 100 battleship games at full load ([measurements](../../reference/performance.md)):

- Compression made whole views 97% smaller on the wire (5,078 to 136 bytes per action) and patches 91% smaller (1,039 to 93), for about 6% more server CPU per action. It's done off the main thread, so actions are answered before their updates are compressed; updates arrive no sooner.
- MessagePack made messages about 20–25% smaller, for 4–9% more server CPU: its encoder is JavaScript, `JSON.stringify` is native. With compression on, it saves little more.
- A host that changes the parser has to change it in every client at the same time.
