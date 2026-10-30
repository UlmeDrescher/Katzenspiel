'use strict';

// Zum Anpassen an die Katze: alle Werte stehen hier an einer Stelle.
const SETTINGS = {
  mouseCount: 4,
  mouseSize: 0.12, // Körperlänge im Verhältnis zur kürzeren Bildschirmseite
  runSpeed: [0.15, 0.45], // Bildschirmseiten pro Sekunde (langsam bis schnell)
  fleeSpeed: 1.1,
  fleeSeconds: 0.7,
  runSeconds: [0.6, 2.2],
  pauseSeconds: [0.3, 1.4],
  hitRadius: 1.2, // in Mauslängen, großzügig, weil Pfoten ungenau treffen
  scareRadius: 2.5,
  reactCooldown: 0.25, // Sekunden, bevor dieselbe Maus erneut reagiert
};

const BACKGROUND = '#cfe8c0';
const MOUSE_COLOR = '#3d3530';
const EAR_COLOR = '#c98a8a';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

let width = 0;
let height = 0;
let unit = 0; // kürzere Bildschirmseite in Pixeln
let mouseLength = 0;
let edgeMargin = 0;

function resize() {
  const ratio = window.devicePixelRatio || 1;
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  unit = Math.min(width, height);
  mouseLength = unit * SETTINGS.mouseSize;
  edgeMargin = mouseLength * 1.5;
}

function randomBetween([min, max]) {
  return min + Math.random() * (max - min);
}

function createMouse() {
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    heading: Math.random() * Math.PI * 2,
    turn: 0,
    speed: 0,
    state: 'pause',
    timeLeft: Math.random(),
    cooldown: 0,
    wiggle: Math.random() * 10,
  };
}

function startRunning(mouse) {
  mouse.state = 'run';
  mouse.timeLeft = randomBetween(SETTINGS.runSeconds);
  mouse.speed = randomBetween(SETTINGS.runSpeed) * unit;
  // Beim Loslaufen abrupt die Richtung wechseln, im Lauf nur leicht kurven
  mouse.heading += (Math.random() - 0.5) * Math.PI * 1.5;
  mouse.turn = (Math.random() - 0.5) * 2.5;
}

function startPause(mouse) {
  mouse.state = 'pause';
  mouse.timeLeft = randomBetween(SETTINGS.pauseSeconds);
  mouse.speed = 0;
}

function flee(mouse, fromX, fromY) {
  mouse.state = 'flee';
  mouse.timeLeft = SETTINGS.fleeSeconds;
  mouse.speed = SETTINGS.fleeSpeed * unit;
  mouse.heading = Math.atan2(mouse.y - fromY, mouse.x - fromX) + (Math.random() - 0.5) * 0.8;
  mouse.turn = 0;
  mouse.cooldown = SETTINGS.reactCooldown;
}

function updateMouse(mouse, dt) {
  mouse.timeLeft -= dt;
  mouse.cooldown -= dt;
  mouse.wiggle += dt * (mouse.speed > 0 ? 14 : 3);

  if (mouse.timeLeft <= 0) {
    if (mouse.state === 'pause') startRunning(mouse);
    else startPause(mouse);
  }

  mouse.heading += mouse.turn * dt;
  mouse.x += Math.cos(mouse.heading) * mouse.speed * dt;
  mouse.y += Math.sin(mouse.heading) * mouse.speed * dt;
  keepOnScreen(mouse);
}

// Am Rand abprallen, damit keine Maus aus dem Bild verschwindet
function keepOnScreen(mouse) {
  if (mouse.x < edgeMargin || mouse.x > width - edgeMargin) {
    mouse.heading = Math.PI - mouse.heading;
    mouse.x = Math.min(Math.max(mouse.x, edgeMargin), width - edgeMargin);
  }
  if (mouse.y < edgeMargin || mouse.y > height - edgeMargin) {
    mouse.heading = -mouse.heading;
    mouse.y = Math.min(Math.max(mouse.y, edgeMargin), height - edgeMargin);
  }
}

function drawMouse(mouse) {
  const l = mouseLength;
  ctx.save();
  ctx.translate(mouse.x, mouse.y);
  ctx.rotate(mouse.heading);

  // Der Schwanz schlängelt sich und ist für die Katze der größte Reiz
  ctx.strokeStyle = MOUSE_COLOR;
  ctx.lineWidth = l * 0.08;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-l * 0.45, 0);
  for (let i = 1; i <= 8; i++) {
    const t = i / 8;
    ctx.lineTo(-l * (0.45 + t * 1.1), Math.sin(mouse.wiggle + t * 5) * l * 0.2 * t);
  }
  ctx.stroke();

  // Körper und Kopf
  ctx.fillStyle = MOUSE_COLOR;
  ctx.beginPath();
  ctx.ellipse(0, 0, l * 0.55, l * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(l * 0.5, 0, l * 0.28, l * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Ohren
  ctx.fillStyle = EAR_COLOR;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(l * 0.38, side * l * 0.22, l * 0.12, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Der Ton wird erst nach der ersten Berührung erlaubt
let audio = null;

function unlockAudio() {
  if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
  if (audio.state === 'suspended') audio.resume();
}

function squeak() {
  if (!audio) return;
  const now = audio.currentTime;
  const start = 1800 + Math.random() * 800;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(start, now);
  oscillator.frequency.exponentialRampToValueAtTime(start * 1.7, now + 0.07);
  oscillator.frequency.exponentialRampToValueAtTime(start * 1.1, now + 0.14);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.25, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
  oscillator.connect(gain).connect(audio.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.16);
}

function reactToPaw(x, y) {
  for (const mouse of mice) {
    if (mouse.cooldown > 0) continue;
    const distance = Math.hypot(mouse.x - x, mouse.y - y);
    if (distance < mouseLength * SETTINGS.hitRadius) {
      flee(mouse, x, y);
      squeak();
    } else if (distance < mouseLength * SETTINGS.scareRadius) {
      flee(mouse, x, y);
    }
  }
}

// Pointer-Ereignisse liefern jede Berührung einzeln, also auch mehrere Pfoten zugleich
canvas.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  unlockAudio();
  requestWakeLock();
  reactToPaw(event.clientX, event.clientY);
});
canvas.addEventListener('pointermove', (event) => {
  if (event.pressure > 0 || event.buttons > 0) reactToPaw(event.clientX, event.clientY);
});
window.addEventListener('contextmenu', (event) => event.preventDefault());

// Der Bildschirm soll während des Spiels nicht ausgehen
let wakeLock = null;

async function requestWakeLock() {
  if (wakeLock || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => {
      wakeLock = null;
    });
  } catch {
    wakeLock = null; // Das Spiel läuft auch ohne weiter
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') requestWakeLock();
});

resize();
window.addEventListener('resize', resize);
const mice = Array.from({ length: SETTINGS.mouseCount }, createMouse);
requestWakeLock();

let lastTime = performance.now();

function frame(time) {
  // Begrenzen, damit die Mäuse nach einer Unterbrechung nicht springen
  const dt = Math.min((time - lastTime) / 1000, 0.05);
  lastTime = time;

  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, width, height);
  for (const mouse of mice) {
    updateMouse(mouse, dt);
    drawMouse(mouse);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {
    // Ohne Service Worker läuft das Spiel nur nicht offline
  });
}
