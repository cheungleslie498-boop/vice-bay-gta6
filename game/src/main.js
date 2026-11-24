// Vice Bay boot + main loop: renderer, camera, input, screens, save, HUD wiring.
// ?seed=N fixes the city. ?shot=start|drive|foot|mission stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady.
import * as THREE from 'three';
import { Game } from './game.js';
import { HUD } from './hud.js';
import { SoundBank } from './audio.js';
import { stageShot } from './shots.js';
import { clamp, lerp } from './util.js';

const SAVE_KEY = 'vicebay-save-v1';
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const titleScreen = document.getElementById('titleScreen');
const endScreen = document.getElementById('endScreen');
const pauseScreen = document.getElementById('pauseScreen');
const endTitle = document.getElementById('endTitle');
const endText = document.getElementById('endText');
const saveLine = document.getElementById('saveLine');
const phoneEl = document.getElementById('phone');
const phoneFrom = document.getElementById('phoneFrom');
const phoneMsg = document.getElementById('phoneMsg');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2600);

const hud = new HUD();
const sounds = new SoundBank();

function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (typeof s.cash !== 'number') return null;
    return s;
  } catch { return null; }
}
function saveGame(game) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: game.cash,
      missionsDone: game.storyDone ? 4 : game.missionIdx,
      storyDone: game.storyDone,
    }));
  } catch { /* storage can be off */ }
}

const save = loadSave();
if (save && (save.cash > 0 || save.missionsDone > 0)) {
  saveLine.textContent = `Saved: $${save.cash.toLocaleString('en-US')} · Missions ${save.missionsDone}/4 complete · ${save.storyDone ? 'Story complete — free roam' : 'Continue the story'}`;
} else {
  saveLine.textContent = 'No save yet — your cash and missions save automatically.';
}

let phoneTimer = null;
function showPhone(from, msg) {
  phoneFrom.textContent = from;
  phoneMsg.textContent = msg;
  phoneEl.style.display = 'block';
  clearTimeout(phoneTimer);
  phoneTimer = setTimeout(() => { phoneEl.style.display = 'none'; }, 6000);
}
function announce(message) { status.textContent = message; }

const game = new Game(scene, seed, {
  onToast: (m) => hud.toast(m),
  onPhone: (f, m) => showPhone(f, m),
  onCash: (n) => hud.setCash(n),
  onWanted: (n) => hud.setWanted(n),
  onHealth: (h) => hud.setHealth(h),
  onSound: (name, opt) => sounds.play(name, opt),
  onMission: () => saveGame(game),
  onBusted: () => endGame('BUSTED', 'The Vice Bay PD caught up with you. Your cash and completed missions are saved — the city is still waiting.'),
  onWasted: () => endGame('WASTED', 'Danny is down. The sun sets on Vice Bay... but a new day is coming. Your cash and missions are saved.'),
});
if (save) {
  game.cash = save.cash;
  hud.setCash(save.cash);
}

// Debug handle (also lets automated checks drive the game).
window.__game = game;
window.__renderer = renderer;
window.__scene = scene;
window.__getState = () => state;
const keys = new Set();
const pressed = new Set();
let camYaw = Math.PI * 0.9;
let camDist = 11;
let camFollowTimer = 0; // seconds until the camera resumes auto-follow behind the car
let dragging = false;
let lastPX = 0, lastPY = 0;

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys.add(e.code);
  pressed.add(e.code);
  if (e.code === 'Space') e.preventDefault();
  if (e.code === 'KeyM') {
    const muted = sounds.toggleMute();
    hud.toast(muted ? 'Sound muted' : 'Sound on');
  }
  if ((e.code === 'KeyP' || e.code === 'Escape') && state === 'play') pauseGame();
  else if ((e.code === 'KeyP' || e.code === 'Escape') && state === 'paused') resumeGame();
  if (e.code === 'Enter' && state === 'title') startGame();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
canvas.addEventListener('pointerdown', (e) => { dragging = true; lastPX = e.clientX; lastPY = e.clientY; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  camYaw -= (e.clientX - lastPX) * 0.005;
  camDist = clamp(camDist + (e.clientY - lastPY) * 0.02, 7, 17);
  lastPX = e.clientX; lastPY = e.clientY;
  camFollowTimer = 3;
});
canvas.addEventListener('pointerup', () => { dragging = false; });
canvas.addEventListener('wheel', (e) => { camDist = clamp(camDist + e.deltaY * 0.01, 7, 17); }, { passive: true });
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function readInput() {
  const input = {
    f: keys.has('KeyW') || keys.has('ArrowUp'),
    b: keys.has('KeyS') || keys.has('ArrowDown'),
    l: keys.has('KeyA') || keys.has('ArrowLeft'),
    r: keys.has('KeyD') || keys.has('ArrowRight'),
    run: keys.has('ShiftLeft') || keys.has('ShiftRight'),
    jump: pressed.has('Space'),
    enter: pressed.has('KeyE'),
    punch: pressed.has('KeyF'),
    handbrake: keys.has('Space'),
    camYaw,
  };
  pressed.clear();
  return input;
}

// ---------- screens / state ----------
let state = 'title'; // title | play | paused | over
let last = performance.now();

function startGame() {
  sounds.ensure();
  sounds.play('click');
  titleScreen.classList.add('hidden');
  hud.show();
  hud.setCash(game.cash);
  hud.setHealth(game.health);
  state = 'play';
  game.startMissions(save ? save.missionsDone : 0);
  if (game.storyDone) hud.toast('Story complete — free roam!');
  announce('Playing Vice Bay. Steal a car with E near one.');
}
function pauseGame() {
  state = 'paused';
  pauseScreen.classList.remove('hidden');
  sounds.engine(0);
}
function resumeGame() {
  state = 'play';
  pauseScreen.classList.add('hidden');
  last = performance.now();
}
function endGame(title, text) {
  state = 'over';
  saveGame(game);
  endTitle.textContent = title;
  endTitle.style.color = title === 'BUSTED' ? '#6ac8ff' : '#ff5a5a';
  endText.textContent = text;
  endScreen.classList.remove('hidden');
  hud.hide();
  sounds.engine(0);
  announce(`${title}. ${text}`);
}
document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('resumeBtn').addEventListener('click', resumeGame);
document.getElementById('retryBtn').addEventListener('click', () => window.location.reload());

// ---------- camera ----------
const camTarget = new THREE.Vector3();
const camPos = new THREE.Vector3(200, 150, 280);
function updateCamera(dt) {
  const focus = game.focusPos();
  const inCar = !!game.playerCar;
  const targetY = inCar ? 1.8 : 1.6;
  // auto-follow behind the car when driving (unless the player just dragged)
  if (inCar) {
    camFollowTimer -= dt;
    if (camFollowTimer <= 0) {
      const want = game.playerCar.heading + Math.PI;
      let dh = want - camYaw;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      camYaw += dh * (1 - Math.exp(-1.6 * dt));
    }
  }
  const dist = inCar ? camDist + 2 : camDist;
  const height = inCar ? 4.6 : 3.4;
  const desired = new THREE.Vector3(
    focus.x + Math.sin(camYaw) * dist,
    height,
    focus.z + Math.cos(camYaw) * dist,
  );
  camPos.lerp(desired, 1 - Math.exp(-8 * dt));
  camTarget.lerp(new THREE.Vector3(focus.x, targetY, focus.z), 1 - Math.exp(-10 * dt));
  camera.position.copy(camPos);
  camera.lookAt(camTarget);
}

// ---------- HUD refresh ----------
let lastHint = '';
function refreshHUD() {
  hud.setClock(game.clockString());
  hud.setObjective(game.objectiveText());
  hud.setWanted(game.wanted);
  if (game.playerCar) {
    hud.setSpeed(Math.abs(game.playerCar.speed) * 2.24);
    hud.setCarHealth(game.playerCar.health);
  } else {
    hud.setSpeed(null);
    hud.setCarHealth(null);
  }
  const hint = game.playerCar
    ? 'E — exit car · SPACE — handbrake · drive to the yellow beacon'
    : game.nearCar
      ? 'Press E to steal the car'
      : 'Find a car — press E near one to steal it · F — punch';
  if (hint !== lastHint) { hud.setHint(hint); lastHint = hint; }
  hud.drawMinimap(game);
}

// ---------- shot mode ----------
// ---------- adaptive quality: SwiftShader / weak GPUs get fewer pixels, no shadows ----------
let qualityLevel = 0;
let fpsEma = 60;
let qualityTimer = 0;
function applyQuality(level) {
  if (level >= 1) {
    renderer.setPixelRatio(0.75);
    renderer.setSize(window.innerWidth, window.innerHeight);
    scene.traverse((o) => { if (o.isDirectionalLight) o.castShadow = false; });
    renderer.shadowMap.enabled = false;
    scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
  }
  if (level >= 2) {
    renderer.setPixelRatio(0.5);
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
function adaptQuality(dt) {
  fpsEma = fpsEma * 0.95 + (1 / Math.max(dt, 1e-3)) * 0.05;
  qualityTimer += dt;
  if (qualityTimer > 3 && qualityLevel < 2 && fpsEma < 22) {
    qualityLevel += 1;
    qualityTimer = 0;
    applyQuality(qualityLevel);
  }
}

if (shot) {
  const staged = stageShot(shot, game);
  if (staged.screen === 'title') {
    titleScreen.classList.remove('hidden');
    hud.hide();
  } else {
    titleScreen.classList.add('hidden');
    hud.show();
    hud.setCash(game.cash);
    hud.setHealth(game.health);
  }
  camera.position.set(staged.camPos.x, staged.camPos.y, staged.camPos.z);
  camera.lookAt(staged.camLook.x, staged.camLook.y, staged.camLook.z);
  refreshHUD();
  // Render synchronously (not via rAF) so headless screenshots always capture the frame.
  renderer.render(scene, camera);
  renderer.render(scene, camera);
  window.__shotReady = true;
} else {
  // ---------- live loop ----------
  camera.position.set(200, 150, 280);
  camera.lookAt(0, 20, 0);
  function loop(now) {
    requestAnimationFrame(loop);
    const rawDt = Math.min((now - last) / 1000, 0.5);
    last = now;
    adaptQuality(rawDt);
    if (state === 'play') {
      const input = readInput();
      // fixed substeps (<= 1/30 s each, max 0.2 s of game time) keep physics
      // stable and time-correct on slow frames instead of one huge step.
      let remaining = Math.min(rawDt, 0.2);
      while (remaining > 0) {
        const step = Math.min(remaining, 1 / 30);
        game.update(step, input, camYaw);
        input.enter = false; input.punch = false; input.jump = false;
        remaining -= step;
      }
      updateCamera(rawDt);
      refreshHUD();
    }
    renderer.render(scene, camera);
  }
  requestAnimationFrame(loop);
}
