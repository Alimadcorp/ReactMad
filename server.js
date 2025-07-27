import express from "express";
import { WebSocketServer } from "ws";
import { v4 as uuid } from "uuid";

const app = express();
app.use(express.static("public"));

const PORT = process.env.PORT || 4568;
const server = app.listen(PORT, () =>
  console.log(`Listening on http://localhost:${PORT}`)
);

const wss = new WebSocketServer({ server });
const clients = new Map();

function broadcast(type, payload, excludeWs = null) {
  const message = JSON.stringify({ type, ...payload });
  for (const client of wss.clients) {
    if (client.readyState === 1 && client !== excludeWs) {
      client.send(message);
    }
  }
}

function getCurrentLeaderboard() {
  return [...clients.values()].map(
    ({ id, username, score, index, offline }) => ({
      id,
      username,
      score,
      index,
      offline: !!offline,
    })
  );
}

wss.on("connection", (ws) => {
  const id = uuid();
  const clientData = {
    id,
    username: `Guest-${id.slice(0, 4)}`,
    score: 0,
    index: 0,
    offline: false,
  };

  clients.set(ws, clientData);
  ws.send(JSON.stringify({ type: "init", id }));

  for (const [otherWs, otherData] of clients.entries()) {
    if (otherWs !== ws) {
      ws.send(
        JSON.stringify({
          type: "update",
          id: otherData.id,
          username: otherData.username,
          score: otherData.score,
          index: otherData.index,
          offline: !clients.has(otherWs),
        })
      );
    }
  }

  ws.send(
    JSON.stringify({
      type: "leaderboard",
      users: getCurrentLeaderboard(),
    })
  );

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch (err) {
      console.error("Invalid JSON");
      return;
    }

    const data = clients.get(ws);
    if (!data) return;

    if (msg.type === "set-username") {
      for (const [clientWs, clientData] of clients.entries()) {
        if (clientData.username === msg.username && clientWs !== ws) {
          clients.delete(clientWs);
          try {
            clientWs.close();
          } catch (e) {}
          broadcast("update", {
            id: data.id,
            username: data.username,
            score: data.score,
            index: data.index,
            offline: data.offline,
          });
          for (const [clientWs, clientData] of clients.entries()) {
            if (clientWs !== ws && clientData.offline) {
              ws.send(
                JSON.stringify({
                  type: "update",
                  id: clientData.id,
                  username: clientData.username,
                  score: clientData.score,
                  index: clientData.index,
                  offline: true,
                })
              );
            }
          }
          break;
        }
      }

      data.username = msg.username;
      broadcast("update", {
        id: data.id,
        username: data.username,
        score: data.score,
        index: data.index,
        offline: data.offline,
      });
    }

    if (msg.type === "update") {
      data.score = msg.score || 0;
      data.index = msg.index || 0;
      data.offline = false;

      broadcast("update", {
        id: data.id,
        username: data.username,
        score: data.score,
        index: data.index,
        x: msg.x,
        y: msg.y,
        offline: data.offline,
      });
    }
  });

  ws.on("close", () => {
    const data = clients.get(ws);
    if (!data) return;

    data.offline = true;
    clients.set(ws, data);

    const leaveMsg = JSON.stringify({
      type: "update",
      id: data.id,
      username: data.username,
      score: data.score,
      index: data.index,
      offline: true,
    });

    for (const client of clients.keys()) {
      if (client.readyState === 1) {
        client.send(leaveMsg);
      }
    }
  });
});
