# 0062. The client reconnects when a page resumes

Status: Accepted
Date: 2026-10-21

## Context

A player may follow a game on a phone, next to or instead of another device ([0019](0019-several-tokens-per-player.md)). Phones put pages to sleep: when the screen goes off or the browser goes to the background, timers stop and connections die without a word. When the page is shown again, Socket.IO may still believe its connection is up, until its ping times out, which takes up to 45 seconds, or it's waiting out its backoff before the next attempt. Meanwhile the view on screen is stale, and the player can't tell.

Every (re)connect already starts with a whole view that replaces the client's ([0055](0055-the-view-on-connect-replaces-the-clients.md)), so reconnecting is always safe, and costs one view.

## Decision

- **In a browser, the client reconnects at once** when the page is shown again after being hidden for a while, 10 seconds by default, and when the network comes back (`online`).
- **A short switch between tabs doesn't count,** so a desktop browser doesn't reconnect every time its tab comes to the front.
- **The client option `resumeAfter`** sets the while, in milliseconds; `null` turns it off. **`page`** gives the page to watch, the browser's `document` and `window` by default, so it can be tested outside a browser.
- **`reconnect()`** on the client does the same on demand, for an app's own reasons, such as a "Reconnect" button.

## Alternatives considered

- **Shorter Socket.IO pings.** A dead connection would be noticed sooner, but never at once, and every client of every game would send more pings all the time.
- **Reconnecting whenever the page is shown.** Simplest, but a desktop reconnects, and fetches a whole view, at every tab switch.
- **Leaving it to apps.** Every app with players on phones would write the same code.

## Consequences

- A phone that wakes up shows the current view within a round trip, rather than after up to 45 seconds.
- A page that was hidden for a while reconnects even if its connection survived: one whole view, which the server computes when it's sent ([0056](0056-views-and-patches-computed-when-sent.md)).
- Outside a browser, nothing changes: there's no page to watch.
