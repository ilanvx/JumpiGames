import {
  setRoom,
  getCurrentRoom,
  getRoomBackground,
  getRoomTrigger,
  getPlayerStart,
  drawRoomTrigger,
  isClickOnTrigger,
  getTriggerTargetRoom,
} from './rooms.js';

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const MAP_WIDTH = 1536;
const MAP_HEIGHT = 1024;

// טוען רקע
let background = new Image();
background.src = getRoomBackground();

// טוען דמויות לפי זוויות
const directions = {
  front: "player/character_down.png",
  back: "player/character_up.png",
  left: "player/character_left.png",
  right: "player/character_right.png",
  up_left: "player/character_up_left.png",
  up_right: "player/character_up_right.png",
  down_left: "player/character_down_left.png",
  down_right: "player/character_down_right.png"
};

const playerSprites = {};
for (let dir in directions) {
  playerSprites[dir] = new Image();
  playerSprites[dir].src = directions[dir];
}

// התחברות ל־Socket.IO
const socket = io();
const myUsername = localStorage.getItem("username") || "שחקן אנונימי";

// שחקן מקומי
let player = {
  x: 250,
  y: 350,
  width: 55,
  height: 70,
  speed: 2,
  direction: "down",
  destX: 250,
  destY: 350,
  bounce: 0,
  username: myUsername
};

// שלח את שם המשתמש לשרת
socket.emit("join", myUsername);

// רשימת שחקנים אחרים
const players = {};

// קבלת עדכוני שחקנים מהשרת
socket.on("players_update", (serverPlayers) => {
  for (const id in serverPlayers) {
    if (id !== socket.id && serverPlayers[id].room === currentRoomName) {
      players[id] = serverPlayers[id];
    } else {
      delete players[id];
    }
  }
});

// התאמה לגודל מסך
function resizeCanvas() {
  const windowRatio = window.innerWidth / window.innerHeight;
  const mapRatio = MAP_WIDTH / MAP_HEIGHT;

  if (windowRatio > mapRatio) {
    canvas.height = window.innerHeight;
    canvas.width = canvas.height * mapRatio;
  } else {
    canvas.width = window.innerWidth;
    canvas.height = canvas.width / mapRatio;
  }
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// המרות בין מפת עולם למסך
function toCanvasX(x) {
  return (x / MAP_WIDTH) * canvas.width;
}
function toCanvasY(y) {
  return (y / MAP_HEIGHT) * canvas.height;
}
function toMapX(x) {
  return (x / canvas.width) * MAP_WIDTH;
}
function toMapY(y) {
  return (y / canvas.height) * MAP_HEIGHT;
}

// תנועה לפי לחיצה
let movingToTrigger = false;
let triggerTargetRoom = null;

canvas.addEventListener("click", (e) => {
  const rect = canvas.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const clickY = e.clientY - rect.top;
  const mapX = toMapX(clickX);
  const mapY = toMapY(clickY);

  if (isClickOnTrigger(mapX, mapY)) {
    // Move to trigger
    const trigger = getRoomTrigger();
    player.destX = trigger.x;
    player.destY = trigger.y;
    movingToTrigger = true;
    triggerTargetRoom = getTriggerTargetRoom();
  } else {
    player.destX = mapX;
    player.destY = mapY;
    movingToTrigger = false;
    triggerTargetRoom = null;
  }
});

// חישוב כיוון לפי זווית
function getDirection(dx, dy) {
  const angle = Math.atan2(dy, dx);
  const deg = angle * 180 / Math.PI;

  if (deg >= -22.5 && deg < 22.5) return "right";
  if (deg >= 22.5 && deg < 67.5) return "down_right";
  if (deg >= 67.5 && deg < 112.5) return "front";
  if (deg >= 112.5 && deg < 157.5) return "down_left";
  if (deg >= 157.5 || deg < -157.5) return "left";
  if (deg >= -157.5 && deg < -112.5) return "up_left";
  if (deg >= -112.5 && deg < -67.5) return "back";
  if (deg >= -67.5 && deg < -22.5) return "up_right";

  return "front";
}

// עדכון מיקום והודעות לשרת
function update() {
  const dx = player.destX - player.x;
  const dy = player.destY - player.y;
  const distance = Math.hypot(dx, dy);

  if (distance > player.speed) {
    const angle = Math.atan2(dy, dx);
    player.x += Math.cos(angle) * player.speed;
    player.y += Math.sin(angle) * player.speed;
    player.direction = getDirection(dx, dy);
    player.bounce += 0.2;
  } else {
    player.x = player.destX;
    player.y = player.destY;
    player.bounce = 0;
    // If moving to trigger and arrived, switch room
    if (movingToTrigger && triggerTargetRoom) {
      const trigger = getRoomTrigger();
      const arrived = Math.hypot(player.x - trigger.x, player.y - trigger.y) < 10;
      if (arrived) {
        switchRoom(triggerTargetRoom);
        movingToTrigger = false;
        triggerTargetRoom = null;
      }
    }
  }

  socket.emit("move", {
    x: player.x,
    y: player.y,
    direction: player.direction,
  });
}

// ציור הדמות שלך והשאר
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
  drawRoomTrigger(ctx, toCanvasX, toCanvasY);

  const drawCharacter = (p, isLocalPlayer = false) => {
    const sprite = playerSprites[p.direction] || playerSprites.down;
    const drawX = toCanvasX(p.x);
    const drawY = toCanvasY(p.y);

    // Draw shadow with blue outline for local player
    if (isLocalPlayer) {
      // Shadow ellipse
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(drawX, drawY - 10, 22, 10, 0, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fill();
      // Blue outline
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#3a7cff';
      ctx.stroke();
      ctx.restore();
    } else {
      // Regular shadow for other players
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(drawX, drawY - 10, 22, 10, 0, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fill();
      ctx.restore();
    }

    ctx.drawImage(
      sprite,
      drawX - player.width / 2,
      drawY - player.height + Math.sin(p.bounce || 0) * 6,
      player.width,
      player.height
    );

    // Username: white with thin black outline, bold font
    ctx.font = 'bold 18px Varela Round, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'black';
    ctx.strokeText(p.username, drawX, drawY + 16);
    ctx.fillStyle = 'white';
    ctx.fillText(p.username, drawX, drawY + 16);
  };

  drawCharacter(player, true); // אתה

  for (const id in players) {
    drawCharacter(players[id], false); // שאר השחקנים
  }
}

// לולאת משחק
function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}
gameLoop();

// On room change, update background and player position
function switchRoom(newRoom) {
  setRoom(newRoom);
  currentRoomName = newRoom;
  background.src = getRoomBackground();
  const start = getPlayerStart(newRoom);
  player.x = start.x;
  player.y = start.y;
  player.destX = start.x;
  player.destY = start.y;
  // Notify server
  socket.emit('room_change', { room: newRoom });
}
