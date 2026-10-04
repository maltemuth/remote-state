/*
 * The tic-tac-toe example client. It gets a code from the example's lobby (the
 * host), exchanges it for a token, then receives whole states over the socket and
 * sends moves over HTTP.
 */

// The example host serves tic-tac-toe under this prefix
const base = "/tic-tac-toe";
// Credentials are kept per tab, so two tabs can play against each other
const storageKey = (gameId) => `tic-tac-toe:${gameId}`;
const $ = (id) => document.getElementById(id);

const request = async (method, path, body, token) => {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body && JSON.stringify(body),
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
    $("rematch-btn").addEventListener("click", () => this.send({ type: "rematch" }));
    document.querySelectorAll(".cell").forEach((cell, index) =>
      cell.addEventListener("click", () =>
        this.send({ type: "place", row: Math.floor(index / 3), col: index % 3 }),
      ),
    );

    if (this.session) this.connect();
  }

  // Create a game if there's none in the URL, then join it through the lobby
  async enter() {
    const name = $("player-name").value.trim();
    if (!name) return this.showError("Please enter your name", "lobby-error");
    try {
      this.gameId ??= (await request("POST", "/lobby/games")).gameId;
      const { code } = await request("POST", `/lobby/games/${this.gameId}/codes`, { name });
      const { playerId, token } = await request("POST", "/api/tokens", { code });
      this.session = { playerId, token };
      sessionStorage.setItem(storageKey(this.gameId), JSON.stringify(this.session));
      history.replaceState(null, "", `#${this.gameId}`);
      this.connect();
    } catch (error) {
      this.showError(error.message, "lobby-error");
    }
  }

  // The socket sends the current state on every (re)connect, then each update
  connect() {
    $("lobby").hidden = true;
    $("game").hidden = false;
    const link = `${location.href.split("#")[0]}#${this.gameId}`;
    $("share-link").href = $("share-link").textContent = link;

    const socket = io({
      path: `${base}/socket.io`,
      auth: { gameId: this.gameId, token: this.session.token },
    });
    socket.on("connect", () => this.setConnection("Connected", true));
    socket.on("disconnect", () => this.setConnection("Disconnected", false));
    socket.on("connect_error", (error) =>
      this.setConnection(`Connection refused: ${error.message}`, false),
    );
    socket.on("state", ({ state }) => this.render(state));
  }

  async send(action) {
    if (!this.session) return;
    try {
      this.showError("");
      await request("POST", `/api/games/${this.gameId}/actions`, { action }, this.session.token);
    } catch (error) {
      this.showError(error.message);
    }
  }

  render(state) {
    const me = this.session.playerId;
    const mine = ["X", "O"].find((mark) => state.seats[mark]?.playerId === me) ?? null;
    const waiting = !state.seats.X || !state.seats.O;
    const myTurn = !waiting && !state.outcome && state.turn === mine;
    const winCells = new Set((state.outcome?.line ?? []).map(([row, col]) => row * 3 + col));

    document.querySelectorAll(".cell").forEach((cell, index) => {
      const value = state.board[Math.floor(index / 3)][index % 3];
      cell.textContent = value ?? "";
      cell.className = `cell ${value ? value.toLowerCase() : ""} ${winCells.has(index) ? "win" : ""}`;
    });
    $("board").classList.toggle("my-turn", myTurn);
    $("rematch-btn").disabled = !state.outcome || !mine;

    for (const mark of ["X", "O"]) {
      const seat = state.seats[mark];
      $(`seat-${mark}`).querySelector("span").textContent = !seat
        ? "(open)"
        : seat.playerId === me ? `${seat.name} (you)` : seat.name;
      $(`seat-${mark}`).classList.toggle("active", !waiting && !state.outcome && state.turn === mark);
    }

    const onTime = state.outcome?.timeout ? " on time" : "";
    const limit = state.turnSeconds ? ` (${state.turnSeconds} s per move)` : "";
    $("game-status").textContent = waiting
      ? "Waiting for an opponent. Share the link below."
      : state.outcome?.winner
        ? state.outcome.winner === mine
          ? `You win${onTime}!`
          : `${state.seats[state.outcome.winner].name} wins${onTime}`
        : state.outcome ? "Draw"
        : myTurn ? `Your turn (${mine})${limit}`
        : `Waiting for ${state.seats[state.turn].name}${limit}`;
  }

  setConnection(message, connected) {
    $("connection-status").textContent = message;
    $("connection-status").className = `connection-status ${connected ? "connected" : "disconnected"}`;
  }

  showError(message, element = "error") {
    $(element).textContent = message;
  }
}

new TicTacToeClient();
