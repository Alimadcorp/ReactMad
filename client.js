const url =
  window.location.href.includes("127.0.0.1") ||
  window.location.href.includes("localhost")
    ? "ws://localhost:4568"
    : "wss://bdb857473f4f.ngrok-free.app";

let trail = [];
let leaderboard = [];
let socket;
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

  const smoothTrail = chaikin(trail, 2);
  for (let i = 0; i < smoothTrail.length - 1; i++) {
    const hue = (frameCount + i * 2) % 360;
    stroke(hue, 80, 100);
    strokeWeight(map(i, 0, smoothTrail.length - 1, 1, 8));
    line(
      smoothTrail[i].x,
      smoothTrail[i].y,
      smoothTrail[i + 1].x,
      smoothTrail[i + 1].y
    );
  }

  for (const username in others) {
    const p = others[username];
    p.x = lerp(p.x, p.tx, 0.4);
    p.y = lerp(p.y, p.ty, 0.4);

    if (!trails[username]) trails[username] = [];
    trails[username].push(createVector(p.x, p.y));
    if (trails[username].length > 10) trails[username].shift();
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
      const isMe = p.username === myUsername;
      const style = `
        margin-bottom: 4px;
        ${isMe ? "color:#0ff;font-weight:bold;" : ""}
        ${p.offline ? "opacity:0.5;font-style:italic;" : ""}
      `.trim();
      return `<div style="${style}">${i + 1}. ${p.username} - Score: ${
        p.score || 0
      } - Lv.${p.index || 0}</div>`;
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

let lastState = {};

function startSocket() {
  socket = new WebSocket(url);

  socket.addEventListener("open", () => {
    socket.send(
      JSON.stringify({
        type: "set-username",
        username: myUsername,
        x: 0,
        y: 0,
        score: score || 0,
        index: parseInt(index) || 0,
      })
    );
  });

  socket.addEventListener("message", async (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.type === "update") {
      if (msg.username !== myUsername) {
        if (!others[msg.username]) {
          others[msg.username] = {
            x: msg.x,
            y: msg.y,
            tx: msg.x,
            ty: msg.y,
          };
        } else {
          others[msg.username].tx = msg.x;
          others[msg.username].ty = msg.y;
        }
      }

      updateLeaderboard(msg);
    } else if (msg.type === "leaderboard") {
      for (let i = 0; i < msg.users.length; i++) {
        updateLeaderboard(msg.users[i]);
      }
    }
    if (msg.type === "won") {
      const loader = document.createElement("div");
      loader.id = "loading-screen";
      loader.style.cssText = `
  position: fixed;
  top: 0; left: 0;
  width: 100vw; height: 100vh;
  background: black;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  z-index: 10000;
`;

      loader.innerHTML = `
  <h1>Loading...</h1>
`;
      document.body.appendChild(loader);
      const container = document.createElement("div");
      container.id = "video-overlay";
      container.style.cssText = `
  display: none;
  position: fixed;
  top: 0; left: 0;
  width: 100vw; height: 100vh;
  z-index: 9999;
  background: black;
`;

      container.innerHTML = `
  <video id="fullscreen-video" playsinline loop
    style="width: 100%; height: 100%; object-fit: cover;">
    <source src="https://ia801309.us.archive.org/23/items/rick-astley-for-5-seconds/Rick%20Astley%20for%205%20seconds.mp4" type="video/mp4">
  </video>
`;
      document.body.appendChild(container);
      setTimeout(() => {
        const video = document.getElementById("fullscreen-video");
        const overlay = document.getElementById("video-overlay");

        loader.style.display = "none";
        overlay.style.display = "block";

        video.muted = false;
        video.volume = 1;
        video.play().catch((err) => console.error("Autoplay failed:", err));
      }, 1000);
    }
  });

  const round = (n) => Math.round(n);

  setInterval(() => {
    const state = {
      x: round(mouseX),
      y: round(mouseY),
      score,
      index: parseInt(index) || 0,
    };

    const changed =
      state.x !== lastState.x ||
      state.y !== lastState.y ||
      state.score !== lastState.score ||
      state.index !== lastState.index;

    if (socket && socket.readyState === WebSocket.OPEN && changed) {
      socket.send(
        JSON.stringify({
          username: myUsername,
          type: "update",
          ...state,
        })
      );
      lastState = state;
    }
  }, 100);
}

function updateLeaderboard(msg) {
  let player = leaderboard.find((p) => p.username === msg.username);
  if (!player) {
    leaderboard.push({
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
    if (player.username === myUsername) continue;

    const trail = trails[player.username];
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
