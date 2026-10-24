/*
 * The tic-tac-toe example client. It gets a code from the example's lobby (the
 * host), and leaves the rest to the Remote State client: exchanging the code for a
 * session, keeping the player's view in step, and sending moves.
 */

import {
  ActionRejectedError,
  createClient,
  redeemCode,
} from "@malte.muth/remote-state-client";

// The example host serves tic-tac-toe under this prefix
const baseUrl = "/tic-tac-toe";
// Sessions are kept per tab, so two tabs can play against each other
const storageKey = (gameId) => `tic-tac-toe:${gameId}`;
const $ = (id) => document.getElementById(id);

// The lobby is the host's own API, not the library's
const lobby = async (path, body) => {
  const response = await fetch(`${baseUrl}/lobby${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || response.statusText);
  return data;
};

class TicTacToeClient {
  constructor() {
    this.gameId = location.hash.slice(1) || null;
    this.session = this.gameId
      ? JSON.parse(sessionStorage.getItem(storageKey(this.gameId)) || "null")
      : null;

    $("enter-btn").textContent = this.gameId ? "Join game" : "New game";
    $("enter-btn").addEventListener("click", () => this.enter());
    $("rematch-btn").addEventListener("click", () =>
      this.send({ type: "rematch" }),
    );
    $("resume-btn").addEventListener("click", () => this.resume());
    document.querySelectorAll(".cell").forEach((cell, index) =>
      cell.addEventListener("click", () =>
        this.send({
          type: "place",
          row: Math.floor(index / 3),
          col: index % 3,
        }),
      ),
    );

    if (this.session) this.connect();
  }

  // Create a game if there's none in the URL, then join it through the lobby
  async enter() {
    const name = $("player-name").value.trim();
    if (!name) return this.showError("Please enter your name", "lobby-error");
    try {
      this.gameId ??= (await lobby("/games")).gameId;
      const { code } = await lobby(`/games/${this.gameId}/codes`, { name });
      this.session = await redeemCode(code, { baseUrl });
      sessionStorage.setItem(
        storageKey(this.gameId),
        JSON.stringify(this.session),
      );
      history.replaceState(null, "", `#${this.gameId}`);
      this.connect();
    } catch (error) {
      this.showError(error.message, "lobby-error");
    }
  }

  // The client receives the player's view and every change to it
  connect() {
    $("lobby").hidden = true;
    $("game").hidden = false;
    const link = `${location.href.split("#")[0]}#${this.gameId}`;
    $("share-link").href = $("share-link").textContent = link;

    this.client = createClient({ session: this.session, baseUrl });
    this.showConnection(this.client.getConnection());
    this.client.onConnection((connection) => this.showConnection(connection));
    this.client.subscribe(({ view }) => this.render(view));
  }

  async send(action) {
    if (!this.client) return;
    try {
      this.showError("");
      await this.client.dispatch(action);
    } catch (error) {
      this.showError(
        error instanceof ActionRejectedError
          ? error.message
          : `Couldn't send the move: ${error.message}`,
      );
    }
  }

  // Resuming is the host's to do, so it goes through the lobby
  async resume() {
    try {
      this.showError("");
      await lobby(`/games/${this.gameId}/resume`);
    } catch (error) {
      this.showError(error.message);
    }
  }

  render(state) {
    const me = this.session.memberId;
    const mine =
      ["X", "O"].find((mark) => state.seats[mark]?.playerId === me) ?? null;
    const waiting = !state.seats.X || !state.seats.O;
    const myTurn =
      !waiting && !state.outcome && !state.paused && state.turn === mine;
    const winCells = new Set(
      (state.outcome?.line ?? []).map(([row, col]) => row * 3 + col),
    );

    document.querySelectorAll(".cell").forEach((cell, index) => {
      const value = state.board[Math.floor(index / 3)][index % 3];
      cell.textContent = value ?? "";
      cell.className = `cell ${value ? value.toLowerCase() : ""} ${winCells.has(index) ? "win" : ""}`;
    });
    $("board").classList.toggle("my-turn", myTurn);
    $("rematch-btn").disabled = !state.outcome || !mine;
    $("resume-btn").hidden = !state.paused;

    for (const mark of ["X", "O"]) {
      const seat = state.seats[mark];
      $(`seat-${mark}`).querySelector("span").textContent = !seat
        ? "(open)"
        : seat.playerId === me
          ? `${seat.name} (you)`
          : seat.name;
      $(`seat-${mark}`).classList.toggle(
        "active",
        !waiting && !state.outcome && state.turn === mark,
      );
    }

    const onTime = state.outcome?.timeout ? " on time" : "";
    const limit = state.turnSeconds ? ` (${state.turnSeconds} s per move)` : "";
    $("game-status").textContent = waiting
      ? "Waiting for an opponent. Share the link below."
      : state.paused
        ? "Paused by a server restart. Resume once both players are back."
        : state.outcome?.winner
          ? state.outcome.winner === mine
            ? `You win${onTime}!`
            : `${state.seats[state.outcome.winner].name} wins${onTime}`
          : state.outcome
            ? "Draw"
            : myTurn
              ? `Your turn (${mine})${limit}`
              : `Waiting for ${state.seats[state.turn].name}${limit}`;
  }

  showConnection(connection) {
    const messages = {
      connecting: "Connecting…",
      connected: "Connected",
      disconnected: "Disconnected, reconnecting…",
      refused: `Connection refused: ${connection.error}`,
    };
    $("connection-status").textContent = messages[connection.status];
    $("connection-status").className =
      `connection-status ${connection.status === "connected" ? "connected" : "disconnected"}`;
  }

  showError(message, element = "error") {
    $(element).textContent = message;
  }
}

new TicTacToeClient();
