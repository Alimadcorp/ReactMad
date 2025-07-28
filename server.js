import express from "express";
import { WebSocketServer } from "ws";

const app = express();
app.use(express.static("public"));

const PORT = process.env.PORT || 4568;
const server = app.listen(PORT, () =>
  console.log(`Listening on http://localhost:${PORT}`)
);

const wss = new WebSocketServer({ server });
const clients = new Map();

const broadcast = (type, payload, exclude = null) => {
  const message = JSON.stringify({ type, ...payload });
  for (const client of wss.clients)
    if (client.readyState === 1 && client !== exclude) client.send(message);
};

const getLeaderboard = () => {
  const seen = new Set();
  return [...clients.values()]
    .filter(({ username }) => !seen.has(username) && seen.add(username))
    .map(({ username, score, index, offline }) => ({
      username,
      score,
      index,
      offline: !!offline,
    }));
};

const handleSetUsername = (ws, msg) => {
  const current = clients.get(ws);
  if (!current) return;

  current.username = msg.username;
  current.score = msg.score;
  current.index = msg.index;
  current.x = 0;
  current.y = 0;
  current.offline = false;
  clients.set(ws, current);

  broadcast("update", {
    username: current.username,
    score: current.score,
    index: current.index,
    x: 0,
    y: 0,
    offline: false,
  });

  ws.send(JSON.stringify({ type: "leaderboard", users: getLeaderboard() }));
};

const handleUpdate = (ws, msg) => {
  const current = clients.get(ws);
  if (!current?.username) return;

  current.score = msg.score || 0;
  current.index = msg.index || 0;
  current.x = msg.x;
  current.y = msg.y;
  current.offline = false;

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
};

const handleWon = (ws) => {
  const current = clients.get(ws);
  if (!current) return;
  broadcast("won", { username: current.username }, ws);
};

const handleMessage = (ws, raw) => {
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch {
    console.error("Invalid JSON");
    return;
  }

  if (msg.type === "set-username") handleSetUsername(ws, msg);
  if (msg.type === "update") handleUpdate(ws, msg);
  if (msg.type === "won") handleWon(ws);
};

const handleClose = (ws) => {
  const user = clients.get(ws);
  if (!user) return;
  user.offline = true;
  broadcast("update", { ...user, offline: true });
};

wss.on("connection", (ws) => {
  clients.set(ws, { username: null, score: 0, index: 0, offline: false });

  ws.on("message", (raw) => handleMessage(ws, raw));
  ws.on("close", () => handleClose(ws));
});
