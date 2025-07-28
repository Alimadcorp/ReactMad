import express from "express";
import { WebSocketServer } from "ws";

const app = express();
app.use(express.static("public"));

const PORT = process.env.PORT || 4568;
const server = app.listen(PORT, () =>
  console.log(`Listening on http://localhost:${PORT}`)
);

const wss = new WebSocketServer({ server });
const clients = new Map(); // Map<ws, { username, score, index, offline }>

function broadcast(type, payload, exclude = null) {
  const message = JSON.stringify({ type, ...payload });
  for (const client of wss.clients) {
    if (client.readyState === 1 && client !== exclude) {
      client.send(message);
    }
  }
}

function getClientByUsername(username) {
  for (const [ws, user] of clients) {
    if (user.username === username) return [ws, user];
  }
  return null;
}

function getLeaderboard() {
  const seen = new Set();
  return [...clients.values()]
    .filter(({ username }) => {
      if (seen.has(username)) return false;
      seen.add(username);
      return true;
    })
    .map(({ username, score, index, offline }) => ({
      username,
      score,
      index,
      offline: !!offline,
    }));
}

wss.on("connection", (ws) => {
  const user = {
    username: null,
    score: 0,
    index: 0,
    offline: false,
  };

  clients.set(ws, user);

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      console.error("Invalid JSON");
      return;
    }
    console.log(msg.type);

    const current = clients.get(ws);
    if (!current) return;

    if (msg.type === "set-username") {
      console.log(msg.username);
      current.username = msg.username;
      current.x = 0;
      current.y = 0;
      current.score = msg.score;
      current.index = msg.index;
      clients.set(ws, current);

      broadcast("update", {
        username: current.username,
        score: current.score,
        index: current.index,
        x: current.x || 0,
        y: current.y || 0,
        offline: false,
      });

      ws.send(JSON.stringify({ type: "leaderboard", users: getLeaderboard() }));
    }

    if (msg.type === "update") {
      if (!current.username) return;
      current.score = msg.score || 0;
      current.index = msg.index || 0;
      current.offline = false;

      current.x = msg.x;
      current.y = msg.y;

      broadcast(
        "update",
        {
          username: current.username,
          score: current.score,
          index: current.index,
          x: current.x,
          y: current.y,
          offline: false,
        },
        ws
      );
    }
  });

  ws.on("close", () => {
    const user = clients.get(ws);
    if (!user) return;

    user.offline = true;
    broadcast("update", { ...user, offline: true });
  });
});
