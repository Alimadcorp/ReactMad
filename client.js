const url =
  window.location.href.includes("127.0.0.1") ||
  window.location.href.includes("localhost")
    ? "ws://localhost:4568"
    : "wss://1f6b959d28e1.ngrok-free.app";
let trail = [];
let leaderboard = [];
let socket;
let myId = null;
let myUsername = localStorage.getItem("r.myusername");
let others = {};
let trails = {};

function setup() {
  createCanvas(windowWidth, windowHeight, P2D);
  colorMode(HSB, 360, 100, 100, 100);
  noFill();
  frameRate(60);
}

function draw() {
  background(0);

  trail.push(createVector(mouseX, mouseY));
  if (trail.length > 10) trail.shift();

  let smoothTrail = chaikin(trail, 2);
  for (let i = 0; i < smoothTrail.length - 1; i++) {
    let hue = (frameCount + i * 2) % 360;
    stroke(hue, 80, 100);
    strokeWeight(map(i, 0, smoothTrail.length - 1, 1, 8));
    line(
      smoothTrail[i].x,
      smoothTrail[i].y,
      smoothTrail[i + 1].x,
      smoothTrail[i + 1].y
    );
  }
  for (const id in others) {
    const p = others[id];
    p.x = lerp(p.x, p.tx, 0.1);
    p.y = lerp(p.y, p.ty, 0.1);

    if (!trails[id]) trails[id] = [];
    trails[id].push(createVector(p.x, p.y));
    if (trails[id].length > 10) trails[id].shift();
  }

  drawOtherPlayers();
  drawLb();
}

function drawLb() {
  const container = document.getElementById("leaderboard");
  if (!container) return;

  const sorted = [...leaderboard].sort((a, b) => b.score - a.score);
  container.innerHTML = sorted
    .map((p, i) => {
      const isMe = p.id === myId;
      const style = `
        margin-bottom: 4px;
        ${isMe ? "color:#0ff;font-weight:bold;" : ""}
        ${p.offline ? "opacity:0.5;font-style:italic;" : ""}
      `.trim();
      return `<div style="${style}">${i + 1}. ${p.username} — Score: ${
        p.score
      } — Lv.${p.index}</div>`;
    })
    .join("");
}

function chaikin(points, iterations) {
  let result = points;
  for (let it = 0; it < iterations; it++) {
    let newPoints = [];
    for (let i = 0; i < result.length - 1; i++) {
      let p1 = result[i];
      let p2 = result[i + 1];
      newPoints.push(p5.Vector.lerp(p1, p2, 0.25));
      newPoints.push(p5.Vector.lerp(p1, p2, 0.75));
    }
    result = newPoints;
  }
  return result;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function startSocket() {
  socket = new WebSocket(url);

  socket.addEventListener("open", () => {
    socket.send(JSON.stringify({ type: "set-username", username: myUsername }));
  });

  socket.addEventListener("message", async (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.type === "init") {
      myId = msg.id;
    } else if (msg.type === "update") {
      if (!others[msg.id]) {
        others[msg.id] = {
          x: msg.x,
          y: msg.y,
          tx: msg.x,
          ty: msg.y,
        };
      } else {
        others[msg.id].tx = msg.x;
        others[msg.id].ty = msg.y;
      }

      updateLeaderboard(msg);
    } else if (msg.type === "leave") {
      delete others[msg.id];
      leaderboard = leaderboard.filter((p) => p.id !== msg.id);
    }
  });

  setInterval(() => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          type: "update",
          x: mouseX,
          y: mouseY,
          score,
          index: parseInt(index) + 1,
        })
      );
    }
  }, 100);
}

function updateLeaderboard(msg) {
  let player = leaderboard.find((p) => p.id === msg.id);
  if (!player) {
    leaderboard.push({
      id: msg.id,
      username: msg.username,
      score: Math.ceil(msg.score),
      index: msg.index,
      offline: !!msg.offline,
    });
  } else {
    player.score = Math.ceil(msg.score);
    player.index = msg.index;
    player.offline = !!msg.offline;
  }
}

if (!myUsername) {
  custom_prompt("Enter a username", (value) => {
    myUsername = value;
    localStorage.setItem("r.myusername", myUsername);
    startSocket();
  });
} else {
  startSocket();
}

function drawOtherPlayers() {
  for (const player of leaderboard) {
    if (player.id === myId) continue;

    const trail = trails[player.id];
    if (!trail || trail.length < 2) continue;

    const smoothTrail = chaikin(trail, 2);
    for (let i = 0; i < smoothTrail.length - 1; i++) {
      stroke(player.offline ? color(0, 0, 80, 10) : color(0, 0, 100, 255));
      strokeWeight(map(i, 0, smoothTrail.length - 1, 1, 8));
      line(
        smoothTrail[i].x,
        smoothTrail[i].y,
        smoothTrail[i + 1].x,
        smoothTrail[i + 1].y
      );
    }

    const pos = smoothTrail[smoothTrail.length - 1];
    fill(0, 0, 100);
    noStroke();
    ellipse(pos.x, pos.y, 10);
  }
}
