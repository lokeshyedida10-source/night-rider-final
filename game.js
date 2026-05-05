const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const speedEl = document.getElementById("speed");
const finalScoreEl = document.getElementById("finalScore");

const overlay = document.getElementById("overlay");
const gameOverOverlay = document.getElementById("gameOver");
const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");
const leftBtn = document.getElementById("leftBtn");
const rightBtn = document.getElementById("rightBtn");
const audioBtn = document.getElementById("audioBtn");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const LANES = 3;
const LANE_WIDTH = WIDTH / LANES;

const keys = {
  left: false,
  right: false,
};

let animationId = null;
let running = false;
let bestScore = Number(localStorage.getItem("nightRiderBest") || 0);
let audioEnabled = true;
bestEl.textContent = bestScore;

const game = {
  time: 0,
  score: 0,
  speedScale: 1,
  roadOffset: 0,
  spawnTimer: 0,
  spawnInterval: 1.2,
  powerSpawnTimer: 0,
  powerSpawnInterval: 7,
  obstacles: [],
  powerUps: [],
  particles: [],
  effects: {
    shieldTime: 0,
    slowTime: 0,
  },
  player: {
    lane: 1,
    x: LANE_WIDTH * 1.5,
    y: HEIGHT - 120,
    width: 54,
    height: 92,
    targetX: LANE_WIDTH * 1.5,
  },
};

function resetGame() {
  game.time = 0;
  game.score = 0;
  game.speedScale = 1;
  game.roadOffset = 0;
  game.spawnTimer = 0;
  game.spawnInterval = 1.2;
  game.powerSpawnTimer = 0;
  game.powerSpawnInterval = 7;
  game.obstacles = [];
  game.powerUps = [];
  game.particles = [];
  game.effects.shieldTime = 0;
  game.effects.slowTime = 0;
  game.player.lane = 1;
  game.player.targetX = LANE_WIDTH * 1.5;
  game.player.x = game.player.targetX;
  scoreEl.textContent = "0";
  speedEl.textContent = "1.0x";
}

function startGame() {
  resetGame();
  initAudio();
  startEngineHum();
  overlay.classList.remove("visible");
  gameOverOverlay.classList.remove("visible");
  running = true;
  if (animationId) cancelAnimationFrame(animationId);
  animationId = requestAnimationFrame(loop);
}

function endGame() {
  running = false;
  playCrashSound();
  finalScoreEl.textContent = Math.floor(game.score);
  gameOverOverlay.classList.add("visible");
  if (game.score > bestScore) {
    bestScore = Math.floor(game.score);
    localStorage.setItem("nightRiderBest", bestScore);
    bestEl.textContent = bestScore;
  }
}

const audio = {
  ctx: null,
  master: null,
  engineOsc: null,
  engineGain: null,
};

function initAudio() {
  if (audio.ctx) return;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) {
    audioEnabled = false;
    audioBtn.textContent = "🔈";
    return;
  }
  audio.ctx = new AudioCtx();
  audio.master = audio.ctx.createGain();
  audio.master.gain.value = 0.13;
  audio.master.connect(audio.ctx.destination);
}

function beep(freq, duration, type = "sine", gainValue = 0.07) {
  if (!audioEnabled || !audio.ctx || !audio.master) return;
  const now = audio.ctx.currentTime;
  const osc = audio.ctx.createOscillator();
  const gain = audio.ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  gain.gain.setValueAtTime(gainValue, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  osc.connect(gain);
  gain.connect(audio.master);
  osc.start(now);
  osc.stop(now + duration);
}

function startEngineHum() {
  if (!audioEnabled || !audio.ctx || !audio.master) return;
  if (audio.engineOsc) return;
  audio.engineOsc = audio.ctx.createOscillator();
  audio.engineGain = audio.ctx.createGain();
  audio.engineOsc.type = "sawtooth";
  audio.engineOsc.frequency.value = 90;
  audio.engineGain.gain.value = 0.018;
  audio.engineOsc.connect(audio.engineGain);
  audio.engineGain.connect(audio.master);
  audio.engineOsc.start();
}

function stopEngineHum() {
  if (!audio.engineOsc) return;
  audio.engineOsc.stop();
  audio.engineOsc.disconnect();
  audio.engineGain.disconnect();
  audio.engineOsc = null;
  audio.engineGain = null;
}

function playPickupSound(type) {
  if (type === "shield") {
    beep(420, 0.12, "triangle", 0.08);
    setTimeout(() => beep(620, 0.14, "triangle", 0.06), 40);
  } else {
    beep(190, 0.1, "square", 0.08);
    setTimeout(() => beep(150, 0.14, "square", 0.06), 55);
  }
}

function playCrashSound() {
  beep(120, 0.26, "sawtooth", 0.15);
}

function spawnObstacle() {
  const lane = Math.floor(Math.random() * LANES);
  const type = Math.random() < 0.78 ? "car" : "truck";
  const width = type === "truck" ? 70 : 56;
  const height = type === "truck" ? 122 : 98;
  const colors = ["#f25f7a", "#ff9a3d", "#76d6ff", "#a88cff"];

  game.obstacles.push({
    lane,
    x: lane * LANE_WIDTH + LANE_WIDTH / 2,
    y: -height - 30,
    width,
    height,
    speed: (290 + Math.random() * 100) * game.speedScale,
    color: colors[Math.floor(Math.random() * colors.length)],
    type,
  });
}

function spawnPowerUp() {
  const lane = Math.floor(Math.random() * LANES);
  const type = Math.random() < 0.5 ? "shield" : "slow";
  game.powerUps.push({
    lane,
    x: lane * LANE_WIDTH + LANE_WIDTH / 2,
    y: -44,
    width: 38,
    height: 38,
    type,
    speed: 240 * game.speedScale,
  });
}

function update(dt) {
  game.time += dt;
  if (game.effects.slowTime > 0) {
    game.effects.slowTime -= dt;
  }
  if (game.effects.shieldTime > 0) {
    game.effects.shieldTime -= dt;
  }
  const slowFactor = game.effects.slowTime > 0 ? 0.65 : 1;
  game.score += 18 * game.speedScale * dt;
  game.speedScale = 1 + Math.min(1.9, game.time / 45);
  game.spawnInterval = Math.max(0.46, 1.2 - game.time * 0.011);
  game.roadOffset += 420 * game.speedScale * dt;
  game.spawnTimer += dt;
  game.powerSpawnTimer += dt;

  if (audio.engineOsc && audio.engineGain && audio.ctx) {
    audio.engineOsc.frequency.setValueAtTime(90 + game.speedScale * 30, audio.ctx.currentTime);
    audio.engineGain.gain.setValueAtTime(0.013 + game.speedScale * 0.003, audio.ctx.currentTime);
  }

  if (game.spawnTimer > game.spawnInterval) {
    game.spawnTimer = 0;
    spawnObstacle();
    if (Math.random() < 0.15 + game.time / 180) spawnObstacle();
  }
  if (game.powerSpawnTimer > game.powerSpawnInterval) {
    game.powerSpawnTimer = 0;
    spawnPowerUp();
  }

  if (keys.left && game.player.lane > 0) {
    game.player.lane -= 1;
    keys.left = false;
    game.player.targetX = game.player.lane * LANE_WIDTH + LANE_WIDTH / 2;
  }
  if (keys.right && game.player.lane < LANES - 1) {
    game.player.lane += 1;
    keys.right = false;
    game.player.targetX = game.player.lane * LANE_WIDTH + LANE_WIDTH / 2;
  }

  game.player.x += (game.player.targetX - game.player.x) * Math.min(1, dt * 14);

  for (let i = game.obstacles.length - 1; i >= 0; i -= 1) {
    const obstacle = game.obstacles[i];
    obstacle.y += obstacle.speed * dt * slowFactor;
    if (obstacle.y > HEIGHT + 140) {
      game.obstacles.splice(i, 1);
    }
  }

  for (let i = game.powerUps.length - 1; i >= 0; i -= 1) {
    const power = game.powerUps[i];
    power.y += power.speed * dt;
    if (power.y > HEIGHT + 80) {
      game.powerUps.splice(i, 1);
    }
  }

  for (let i = game.particles.length - 1; i >= 0; i -= 1) {
    const p = game.particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 180 * dt;
    p.life -= dt;
    if (p.life <= 0) game.particles.splice(i, 1);
  }

  const hit = checkCollision();
  if (hit) {
    if (game.effects.shieldTime > 0) {
      burstShieldParticles();
      game.effects.shieldTime = 0;
      game.obstacles = game.obstacles.filter((o) => Math.abs(o.y - game.player.y) > 100);
      beep(700, 0.1, "triangle", 0.07);
    } else {
      burstCrashParticles();
      endGame();
      stopEngineHum();
    }
  }
  collectPowerUps();

  scoreEl.textContent = Math.floor(game.score);
  speedEl.textContent = `${game.speedScale.toFixed(1)}x`;
}

function checkCollision() {
  const p = game.player;
  const playerBox = {
    x: p.x - p.width / 2 + 8,
    y: p.y - p.height / 2 + 6,
    width: p.width - 16,
    height: p.height - 12,
  };

  return game.obstacles.some((o) => {
    const box = {
      x: o.x - o.width / 2 + 8,
      y: o.y - o.height / 2 + 6,
      width: o.width - 16,
      height: o.height - 12,
    };
    return (
      playerBox.x < box.x + box.width &&
      playerBox.x + playerBox.width > box.x &&
      playerBox.y < box.y + box.height &&
      playerBox.y + playerBox.height > box.y
    );
  });
}

function burstCrashParticles() {
  const p = game.player;
  for (let i = 0; i < 32; i += 1) {
    const angle = (Math.PI * 2 * i) / 32;
    const speed = 80 + Math.random() * 180;
    game.particles.push({
      x: p.x,
      y: p.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 40,
      life: 0.5 + Math.random() * 0.4,
      size: 2 + Math.random() * 4,
      color: i % 2 === 0 ? "#ff5e7a" : "#7ad4ff",
    });
  }
}

function burstShieldParticles() {
  const p = game.player;
  for (let i = 0; i < 20; i += 1) {
    const angle = (Math.PI * 2 * i) / 20;
    game.particles.push({
      x: p.x,
      y: p.y,
      vx: Math.cos(angle) * (70 + Math.random() * 100),
      vy: Math.sin(angle) * (70 + Math.random() * 100),
      life: 0.25 + Math.random() * 0.3,
      size: 3 + Math.random() * 3,
      color: "#71eaff",
    });
  }
}

function collectPowerUps() {
  const p = game.player;
  const playerBox = {
    x: p.x - p.width / 2,
    y: p.y - p.height / 2,
    width: p.width,
    height: p.height,
  };
  for (let i = game.powerUps.length - 1; i >= 0; i -= 1) {
    const item = game.powerUps[i];
    const itemBox = {
      x: item.x - item.width / 2,
      y: item.y - item.height / 2,
      width: item.width,
      height: item.height,
    };
    const overlap =
      playerBox.x < itemBox.x + itemBox.width &&
      playerBox.x + playerBox.width > itemBox.x &&
      playerBox.y < itemBox.y + itemBox.height &&
      playerBox.y + playerBox.height > itemBox.y;
    if (overlap) {
      if (item.type === "shield") {
        game.effects.shieldTime = 6;
      } else {
        game.effects.slowTime = 4;
      }
      playPickupSound(item.type);
      game.powerUps.splice(i, 1);
    }
  }
}

function drawRoad() {
  ctx.fillStyle = "#0a0f1d";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = "#111a31";
  ctx.fillRect(LANE_WIDTH * 0.08, 0, WIDTH - LANE_WIDTH * 0.16, HEIGHT);

  ctx.fillStyle = "#202a46";
  ctx.fillRect(0, 0, 10, HEIGHT);
  ctx.fillRect(WIDTH - 10, 0, 10, HEIGHT);

  const lineHeight = 46;
  const gap = 34;
  const unit = lineHeight + gap;
  const offset = game.roadOffset % unit;

  ctx.fillStyle = "#37476e";
  for (let lane = 1; lane < LANES; lane += 1) {
    const x = lane * LANE_WIDTH - 4;
    for (let y = -unit + offset; y < HEIGHT + unit; y += unit) {
      ctx.fillRect(x, y, 8, lineHeight);
    }
  }
}

function drawGlow(x, y, w, h, color, blur = 16) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

function drawPlayer() {
  const p = game.player;
  const x = p.x - p.width / 2;
  const y = p.y - p.height / 2;

  drawGlow(x + p.width * 0.38, y + p.height - 12, p.width * 0.24, 8, "#45d9ff", 20);

  ctx.fillStyle = "#1a2b56";
  ctx.fillRect(x + 16, y + 10, p.width - 32, p.height - 20);

  ctx.fillStyle = "#5d8dff";
  ctx.beginPath();
  ctx.moveTo(x + p.width / 2, y);
  ctx.lineTo(x + p.width - 8, y + p.height - 24);
  ctx.lineTo(x + 8, y + p.height - 24);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#77ecff";
  ctx.fillRect(x + p.width / 2 - 6, y + 24, 12, 26);

  ctx.fillStyle = "#050a15";
  ctx.fillRect(x + 8, y + p.height - 20, 12, 20);
  ctx.fillRect(x + p.width - 20, y + p.height - 20, 12, 20);

  if (game.effects.shieldTime > 0) {
    ctx.strokeStyle = "rgba(100, 240, 255, 0.8)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.width * 0.7, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawObstacle(obstacle) {
  const x = obstacle.x - obstacle.width / 2;
  const y = obstacle.y - obstacle.height / 2;
  const bodyColor = obstacle.color;
  const accent = obstacle.type === "truck" ? "#ffd166" : "#9fe8ff";

  ctx.fillStyle = bodyColor;
  ctx.fillRect(x, y, obstacle.width, obstacle.height);

  ctx.fillStyle = "#1a2340";
  ctx.fillRect(x + 8, y + 12, obstacle.width - 16, obstacle.height * 0.38);

  ctx.fillStyle = accent;
  ctx.fillRect(x + obstacle.width * 0.25, y + obstacle.height - 15, obstacle.width * 0.5, 6);
  drawGlow(x + obstacle.width * 0.25, y + obstacle.height - 11, obstacle.width * 0.5, 3, accent, 10);

  ctx.fillStyle = "#070d1a";
  ctx.fillRect(x + 6, y + obstacle.height - 20, 12, 20);
  ctx.fillRect(x + obstacle.width - 18, y + obstacle.height - 20, 12, 20);
}

function drawPowerUp(item) {
  const x = item.x - item.width / 2;
  const y = item.y - item.height / 2;
  const color = item.type === "shield" ? "#6ee8ff" : "#b59dff";
  const symbol = item.type === "shield" ? "S" : "T";
  drawGlow(x, y, item.width, item.height, color, 14);
  ctx.fillStyle = "#0f1a33";
  ctx.fillRect(x + 2, y + 2, item.width - 4, item.height - 4);
  ctx.fillStyle = color;
  ctx.font = "bold 22px Segoe UI";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(symbol, item.x, item.y + 1);
}

function drawParticles() {
  for (const p of game.particles) {
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

function render() {
  drawRoad();
  for (const obstacle of game.obstacles) drawObstacle(obstacle);
  for (const item of game.powerUps) drawPowerUp(item);
  drawPlayer();
  drawParticles();
  drawEffectsHud();
}

function drawEffectsHud() {
  const labels = [];
  if (game.effects.shieldTime > 0) labels.push(`Shield ${game.effects.shieldTime.toFixed(1)}s`);
  if (game.effects.slowTime > 0) labels.push(`Traffic Slow ${game.effects.slowTime.toFixed(1)}s`);
  if (labels.length === 0) return;
  ctx.fillStyle = "rgba(8, 14, 30, 0.62)";
  ctx.fillRect(12, 14, 220, 54);
  ctx.strokeStyle = "rgba(115, 148, 255, 0.5)";
  ctx.strokeRect(12, 14, 220, 54);
  ctx.fillStyle = "#c9d7ff";
  ctx.font = "600 15px Segoe UI";
  ctx.textAlign = "left";
  ctx.fillText(labels.join(" | "), 20, 47);
}

let last = 0;
function loop(timestamp) {
  if (!running) return;
  const dt = Math.min((timestamp - last) / 1000 || 0.016, 0.033);
  last = timestamp;
  update(dt);
  render();
  animationId = requestAnimationFrame(loop);
}

function onKeyDown(event) {
  if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") keys.left = true;
  if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") keys.right = true;
}

function moveLeft() {
  keys.left = true;
}

function moveRight() {
  keys.right = true;
}

function bindPress(el, fn) {
  const handler = (event) => {
    event.preventDefault();
    fn();
  };
  el.addEventListener("touchstart", handler, { passive: false });
  el.addEventListener("mousedown", handler);
}

function toggleAudio() {
  audioEnabled = !audioEnabled;
  audioBtn.textContent = audioEnabled ? "🔊" : "🔈";
  if (audio.ctx && audio.ctx.state === "suspended" && audioEnabled) audio.ctx.resume();
  if (!audioEnabled) {
    stopEngineHum();
  } else if (running) {
    startEngineHum();
  }
}

startBtn.addEventListener("click", startGame);
restartBtn.addEventListener("click", startGame);
window.addEventListener("keydown", onKeyDown);
bindPress(leftBtn, moveLeft);
bindPress(rightBtn, moveRight);
audioBtn.addEventListener("click", toggleAudio);
audioBtn.addEventListener("touchstart", (event) => {
  event.preventDefault();
  toggleAudio();
}, { passive: false });

render();
