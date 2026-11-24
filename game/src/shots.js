// Deterministic staged scenes for screenshots (?shot=start|drive|foot|mission).
// Each runs the real simulation forward from a fresh seeded world with scripted
// inputs, so the frame is what real play looks like and the same seed always
// gives the same frame. Returns the camera + screen for main.js to paint.
import { clamp } from './util.js';

const STEP = 1 / 60;

function runSteps(game, seconds, inputFn) {
  const n = Math.round(seconds / STEP);
  for (let i = 0; i < n; i++) {
    const input = inputFn(i * STEP, i);
    game.update(STEP, input, input.camYaw || 0);
    input.enter = false; input.punch = false; input.jump = false;
  }
}

const IDLE = { f: false, b: false, l: false, r: false, run: false, jump: false, enter: false, punch: false, handbrake: false, camYaw: 0 };

export function stageShot(name, game) {
  if (name === 'start') {
    return { screen: 'title', hud: false, camPos: { x: 200, y: 150, z: 280 }, camLook: { x: -40, y: 25, z: -40 } };
  }
  if (name === 'drive') {
    // put the player in a parked car heading east through downtown, wanted 2, police chase
    const car = game.cars.find((c) => c.kind === 'parked');
    car.pos.x = -252; car.pos.z = 0; car.heading = Math.PI / 2;
    game.player.pos.x = car.pos.x; game.player.pos.z = car.pos.z;
    game.enterCar(car);
    game.setWanted(2);
    game.startMissions();
    const camYaw = Math.PI / 2 + Math.PI; // behind the car
    // straight down the road, no steering — the car stays on the avenue
    runSteps(game, 8, () => ({ ...IDLE, f: true, camYaw }));
    const focus = game.focusPos();
    const h = game.playerCar.heading;
    return {
      screen: 'play', hud: true,
      camPos: { x: focus.x - Math.sin(h) * 11, y: 5.2, z: focus.z - Math.cos(h) * 11 },
      camLook: { x: focus.x + Math.sin(h) * 8, y: 1.6, z: focus.z + Math.cos(h) * 8 },
    };
  }
  if (name === 'foot') {
    // on foot in Starfish Plaza, walking toward the fountain with palms around
    game.startMissions();
    game.player.pos.x = -58; game.player.pos.z = -36;
    game.player.heading = Math.PI / 2; // east, toward the fountain
    const camYaw = Math.PI / 2 + Math.PI;
    runSteps(game, 4.5, (t) => ({ ...IDLE, f: true, run: t < 2.5, camYaw }));
    const p = game.player.pos;
    const h = game.player.heading;
    return {
      screen: 'play', hud: true,
      camPos: { x: p.x - Math.sin(h) * 7.5, y: 3.6, z: p.z - Math.cos(h) * 7.5 },
      camLook: { x: p.x + Math.sin(h) * 6, y: 1.6, z: p.z + Math.cos(h) * 6 },
    };
  }
  if (name === 'mission') {
    // mission 2: package run — at the docks, driving onto the pier toward the beacon
    const car = game.cars.find((c) => c.kind === 'parked');
    car.pos.x = 296; car.pos.z = -108; car.heading = Math.PI / 2;
    game.player.pos.x = car.pos.x; game.player.pos.z = car.pos.z;
    game.enterCar(car);
    game.missionActive = true;
    game.missionIdx = 1; game.stageIdx = 0; game.stageTimer = 0;
    game.phone('MAMA ROSA', "A package is waiting on the docks, east side. Pick it up, take it to the Vice Bay Hotel. Fast — the client pays for speed.");
    runSteps(game, 2.2, () => ({ ...IDLE, f: true, camYaw: Math.PI / 2 + Math.PI }));
    const focus = game.focusPos();
    const h = game.playerCar.heading;
    return {
      screen: 'play', hud: true,
      camPos: { x: focus.x - Math.sin(h) * 12, y: 6, z: focus.z - Math.cos(h) * 12 },
      camLook: { x: focus.x + Math.sin(h) * 10, y: 2, z: focus.z + Math.cos(h) * 10 },
    };
  }
  return stageShot('start', game);
}

export const SHOT_NAMES = ['start', 'drive', 'foot', 'mission'];
