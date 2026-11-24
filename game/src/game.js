// Vice Bay core simulation: player on foot, drivable cars, traffic, pedestrians,
// police pursuit, wanted system and story missions. All original code and art.
import * as THREE from 'three';
import { mulberry32, pick, range, rangeInt, clamp, lerp } from './util.js';
import { createCity, collideCircle, ROAD_CENTERS, BOUNDS } from './city.js';
import { MISSIONS, STORY_COMPLETE_BONUS } from './missions.js';

const CAR_COLORS = [0xc03a2a, 0x2a6ac0, 0xe8c832, 0x3aa84a, 0xd8d8d8, 0x2a2a2a, 0x7a4ac0, 0xe88a2a, 0x38b8c0, 0xb03060];
const SHIRT_COLORS = [0xe8e8e8, 0x3a6ac0, 0xc03a2a, 0x3aa84a, 0xe8c832, 0x7a4ac0, 0x38b8c0, 0xe88a2a];
const PANTS_COLORS = [0x2a2a3a, 0x3a3a4a, 0x5a4a3a, 0x2a3a2a];

function lambert(color) { return new THREE.MeshLambertMaterial({ color }); }

export function buildCar(color, police = false) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), lambert(police ? 0x1a1a22 : color));
  body.position.y = 0.62; body.castShadow = true; g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.1), lambert(0x18202c));
  cabin.position.set(0, 1.18, -0.3); cabin.castShadow = true; g.add(cabin);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.14, 4.42), lambert(police ? 0xe8e8e8 : 0x000000));
  stripe.material.transparent = true; stripe.material.opacity = police ? 1 : 0.25;
  stripe.position.y = 0.72; g.add(stripe);
  // headlights + taillights
  const hl = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.16, 0.1), new THREE.MeshBasicMaterial({ color: 0xfff2b0 }));
  hl.position.set(0, 0.62, 2.21); g.add(hl);
  const tl = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.14, 0.1), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
  tl.position.set(0, 0.62, -2.21); g.add(tl);
  const wheels = [];
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = lambert(0x141414);
  for (const [x, z] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.position.set(x, 0.38, z); w.castShadow = true; g.add(w); wheels.push(w);
  }
  let lightBar = null;
  if (police) {
    lightBar = new THREE.Group();
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 0.4), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    r.position.x = -0.35; lightBar.add(r);
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 0.4), new THREE.MeshBasicMaterial({ color: 0x2040ff }));
    b.position.x = 0.35; lightBar.add(b);
    lightBar.position.set(0, 1.52, -0.3);
    g.add(lightBar);
    const star = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.5, 1.2), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    star.position.set(0, 0.75, 0.4); star.material.transparent = true; star.material.opacity = 0.9;
    g.add(star);
  }
  return { group: g, wheels, lightBar };
}

export function buildPerson(shirt, pants, skin = 0xd8a880) {
  const g = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.72, 0.32), lambert(shirt));
  torso.position.y = 1.08; torso.castShadow = true; g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.36, 0.32), lambert(skin));
  head.position.y = 1.62; head.castShadow = true; g.add(head);
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.12, 0.34), lambert(0x2a1a12));
  hair.position.y = 1.82; g.add(hair);
  const legGeo = new THREE.BoxGeometry(0.22, 0.72, 0.24);
  legGeo.translate(0, -0.36, 0);
  const legMat = lambert(pants);
  const legL = new THREE.Mesh(legGeo, legMat); legL.position.set(-0.14, 0.72, 0); g.add(legL);
  const legR = new THREE.Mesh(legGeo, legMat); legR.position.set(0.14, 0.72, 0); g.add(legR);
  const armGeo = new THREE.BoxGeometry(0.16, 0.62, 0.18);
  armGeo.translate(0, -0.31, 0);
  const armMat = lambert(shirt);
  const armL = new THREE.Mesh(armGeo, armMat); armL.position.set(-0.36, 1.4, 0); g.add(armL);
  const armR = new THREE.Mesh(armGeo, armMat); armR.position.set(0.36, 1.4, 0); g.add(armR);
  return { group: g, legL, legR, armL, armR, torso, head };
}

function roadPoint(rng, near, dist) {
  // a point on a road centre, roughly `dist` from `near`
  for (let tries = 0; tries < 20; tries++) {
    const alongX = rng() < 0.5;
    const road = pick(rng, ROAD_CENTERS);
    const t = range(rng, -280, 280);
    const p = alongX ? { x: t, z: road } : { x: road, z: t };
    if (!near || Math.hypot(p.x - near.x, p.z - near.z) > dist) return p;
  }
  return { x: 0, z: 0 };
}

export class Game {
  constructor(scene, seed = 1337, hooks = {}) {
    this.hooks = hooks; // {onToast,onPhone,onBusted,onWasted,onMission,onCash,onWanted,onSound}
    this.rng = mulberry32(seed);
    this.city = createCity(scene, seed);
    this.scene = scene;
    this.time = 0;
    this.clockMin = 18 * 60; // 18:00
    this.cash = 0;
    this.health = 100;
    this.wanted = 0;
    this.wantedTimer = 0; // time with no police near
    this.lastStealAt = -100;
    this.storyDone = false;
    this.missionIdx = 0;
    this.stageIdx = 0;
    this.stageTimer = 0;
    this.holdTimer = 0;
    this.missionActive = false;
    this.bustedTimer = 0;
    this.gameOver = false;

    // ---- player ----
    const p = buildPerson(0x2a8a7a, 0x2a2a3a, 0xd8a880);
    this.player = {
      mesh: p, pos: { x: this.city.spawn.x, z: this.city.spawn.z },
      heading: Math.PI * 0.75, speed: 0, vy: 0, onGround: true,
      walkPhase: 0, punchTimer: 0, punchCooldown: 0,
    };
    scene.add(p.group);

    // ---- cars ----
    this.cars = []; // traffic + parked + police (playerCar is one of them when driving)
    this.playerCar = null;
    for (let i = 0; i < 8; i++) this.spawnTrafficCar(null);
    for (let i = 0; i < 7; i++) this.spawnParkedCar();
    this.police = [];

    // ---- pedestrians ----
    this.peds = [];
    for (let i = 0; i < 16; i++) this.spawnPed(null);

    // ---- mission beacon ----
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false });
    this.beacon = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 42, 20, 1, true), beaconMat);
    this.beacon.position.y = 21;
    this.beacon.visible = false;
    scene.add(this.beacon);
    const ringGeo = new THREE.RingGeometry(2.6, 3.4, 32);
    ringGeo.rotateX(-Math.PI / 2);
    this.beaconRing = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
    this.beaconRing.position.y = 0.15;
    this.beaconRing.visible = false;
    scene.add(this.beaconRing);

    // ---- car enter prompt target ----
    this.nearCar = null;
  }

  // ---------- helpers ----------
  distTo(x, z) {
    const p = this.focusPos();
    return Math.hypot(p.x - x, p.z - z);
  }
  focusPos() {
    return this.playerCar ? this.playerCar.pos : this.player.pos;
  }
  get inCar() { return !!this.playerCar; }
  toast(msg) { this.hooks.onToast && this.hooks.onToast(msg); }
  phone(from, msg) { this.hooks.onPhone && this.hooks.onPhone(from, msg); }
  sound(name, opt) { this.hooks.onSound && this.hooks.onSound(name, opt); }
  addCash(n) { this.cash += n; this.hooks.onCash && this.hooks.onCash(this.cash); }
  setWanted(n) {
    n = clamp(Math.round(n), 0, 5);
    if (n !== this.wanted) { this.wanted = n; this.hooks.onWanted && this.hooks.onWanted(n); }
  }

  spawnTrafficCar(nearPos) {
    const p = roadPoint(this.rng, nearPos, 60);
    const alongX = Math.abs(p.z - ROAD_CENTERS.reduce((a, r) => Math.abs(p.z - r) < Math.abs(p.z - a) ? r : a, ROAD_CENTERS[0])) < 1;
    const heading = alongX ? (this.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (this.rng() < 0.5 ? 0 : Math.PI);
    const { group, wheels } = buildCar(pick(this.rng, CAR_COLORS));
    const car = {
      mesh: group, wheels, pos: { x: p.x, z: p.z }, heading,
      speed: range(this.rng, 8, 12), targetSpeed: range(this.rng, 8, 12),
      kind: 'traffic', health: 100, wp: null, stopped: 0,
    };
    car.wp = this.nextWaypoint(car);
    this.scene.add(group);
    this.cars.push(car);
    return car;
  }

  spawnParkedCar() {
    // parked along a road edge, near a block
    const alongX = this.rng() < 0.5;
    const road = pick(this.rng, ROAD_CENTERS);
    const t = range(this.rng, -260, 260);
    const side = this.rng() < 0.5 ? 1 : -1;
    const pos = alongX
      ? { x: t, z: road + side * 6.5 }
      : { x: road + side * 6.5, z: t };
    const heading = alongX ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : (side > 0 ? Math.PI : 0);
    const { group, wheels } = buildCar(pick(this.rng, CAR_COLORS));
    const car = { mesh: group, wheels, pos, heading, speed: 0, targetSpeed: 0, kind: 'parked', health: 100, stolen: false };
    this.scene.add(group);
    this.cars.push(car);
    return car;
  }

  spawnPed(nearPos) {
    const p = roadPoint(this.rng, nearPos, 40);
    const m = buildPerson(pick(this.rng, SHIRT_COLORS), pick(this.rng, PANTS_COLORS), pick(this.rng, [0xd8a880, 0xa8805a, 0x8a5a3a, 0xe8c8a8]));
    const ped = {
      mesh: m, pos: { x: p.x, z: p.z }, heading: this.rng() * Math.PI * 2,
      speed: range(this.rng, 1.2, 2.2), wp: null, down: 0, phase: this.rng() * 6,
    };
    ped.wp = this.nextPedWaypoint(ped);
    this.scene.add(m.group);
    this.peds.push(ped);
    return ped;
  }

  nextWaypoint(car) {
    // next intersection along the road grid, with a lane offset
    const x = car.pos.x, z = car.pos.z;
    const opts = [];
    const rx = ROAD_CENTERS.reduce((a, r) => Math.abs(x - r) < Math.abs(x - a) ? r : a, ROAD_CENTERS[0]);
    const rz = ROAD_CENTERS.reduce((a, r) => Math.abs(z - r) < Math.abs(z - a) ? r : a, ROAD_CENTERS[0]);
    for (const r of ROAD_CENTERS) {
      if (Math.abs(r - rx) > 1) opts.push({ x: r, z: rz });
      if (Math.abs(r - rz) > 1) opts.push({ x: rx, z: r });
    }
    return pick(this.rng, opts);
  }

  nextPedWaypoint(ped) {
    const x = ped.pos.x, z = ped.pos.z;
    const rx = ROAD_CENTERS.reduce((a, r) => Math.abs(x - r) < Math.abs(x - a) ? r : a, ROAD_CENTERS[0]);
    const rz = ROAD_CENTERS.reduce((a, r) => Math.abs(z - r) < Math.abs(z - a) ? r : a, ROAD_CENTERS[0]);
    const opts = [];
    for (const r of ROAD_CENTERS) {
      if (Math.abs(r - rx) > 1) opts.push({ x: r, z: rz + 10.5 });
      if (Math.abs(r - rz) > 1) opts.push({ x: rx + 10.5, z: r });
    }
    return pick(this.rng, opts);
  }

  // ---------- player on foot ----------
  updatePlayer(dt, input, camYaw) {
    const pl = this.player;
    if (pl.punchCooldown > 0) pl.punchCooldown -= dt;
    if (pl.punchTimer > 0) pl.punchTimer -= dt;
    let mx = 0, mz = 0;
    if (input.f) { mx -= Math.sin(camYaw); mz -= Math.cos(camYaw); }
    if (input.b) { mx += Math.sin(camYaw); mz += Math.cos(camYaw); }
    if (input.l) { mx -= Math.cos(camYaw); mz += Math.sin(camYaw); }
    if (input.r) { mx += Math.cos(camYaw); mz -= Math.sin(camYaw); }
    const len = Math.hypot(mx, mz);
    const run = input.run ? 8.5 : 5;
    if (len > 0) {
      mx /= len; mz /= len;
      const targetHeading = Math.atan2(mx, mz);
      let dh = targetHeading - pl.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      pl.heading += clamp(dh, -8 * dt, 8 * dt);
      pl.speed = lerp(pl.speed, run, 1 - Math.exp(-10 * dt));
      pl.pos.x += Math.sin(pl.heading) * pl.speed * dt;
      pl.pos.z += Math.cos(pl.heading) * pl.speed * dt;
      pl.walkPhase += dt * pl.speed * 1.6;
    } else {
      pl.speed = lerp(pl.speed, 0, 1 - Math.exp(-10 * dt));
    }
    // jump / gravity
    if (input.jump && pl.onGround) { pl.vy = 7.5; pl.onGround = false; }
    if (!pl.onGround) {
      pl.vy -= 22 * dt;
      pl.jumpY = (pl.jumpY || 0) + pl.vy * dt;
      if (pl.jumpY <= 0) { pl.jumpY = 0; pl.vy = 0; pl.onGround = true; }
    }
    const fixed = collideCircle(this.city.buildings, pl.pos.x, pl.pos.z, 0.6);
    pl.pos.x = fixed.x; pl.pos.z = fixed.z;
    // punch
    if (input.punch && pl.punchCooldown <= 0) {
      pl.punchCooldown = 0.45; pl.punchTimer = 0.25;
      this.sound('punch');
      const fx = pl.pos.x + Math.sin(pl.heading) * 1.6, fz = pl.pos.z + Math.cos(pl.heading) * 1.6;
      for (const ped of this.peds) {
        if (ped.down <= 0 && Math.hypot(ped.pos.x - fx, ped.pos.z - fz) < 1.6) {
          this.knockPed(ped, 'punched');
          break;
        }
      }
    }
    // animate
    const swing = Math.min(pl.speed / 5, 1.6) * Math.sin(pl.walkPhase);
    pl.mesh.legL.rotation.x = swing;
    pl.mesh.legR.rotation.x = -swing;
    pl.mesh.armL.rotation.x = -swing * 0.8 + (pl.punchTimer > 0 ? -1.4 : 0);
    pl.mesh.armR.rotation.x = swing * 0.8 + (pl.punchTimer > 0 ? -1.4 : 0);
    pl.mesh.group.position.set(pl.pos.x, pl.jumpY || 0, pl.pos.z);
    pl.mesh.group.rotation.y = pl.heading;
  }

  knockPed(ped, how) {
    ped.down = 6;
    ped.mesh.group.rotation.x = -Math.PI / 2;
    ped.mesh.group.position.y = 0.3;
    this.sound('thud');
    if (how === 'punched' || how === 'run over') {
      this.setWanted(this.wanted + 1);
      this.toast(how === 'punched' ? 'Assault! Wanted level up' : 'Pedestrian down! Wanted level up');
    }
  }

  // ---------- driving ----------
  updatePlayerCar(dt, input) {
    const car = this.playerCar;
    const accel = input.f ? 15 : 0;
    const brake = input.b ? 24 : 0;
    if (input.f) car.speed += accel * dt;
    if (input.b) {
      if (car.speed > 0.5) car.speed -= brake * dt;
      else car.speed = Math.max(car.speed - 8 * dt, -12);
    }
    if (!input.f && !input.b) car.speed = lerp(car.speed, 0, 1 - Math.exp(-1.2 * dt));
    if (input.handbrake) car.speed = lerp(car.speed, 0, 1 - Math.exp(-3 * dt));
    car.speed = clamp(car.speed, -12, 38);
    // steering
    const steerInput = (input.l ? 1 : 0) - (input.r ? 1 : 0);
    const steerMax = 0.55 * (1 - Math.min(Math.abs(car.speed) / 38, 0.7));
    car.steer = lerp(car.steer || 0, steerInput * steerMax, 1 - Math.exp(-8 * dt));
    const grip = input.handbrake ? 1.9 : 1.0;
    car.heading += (car.speed / 4.4) * Math.tan(car.steer) * grip * dt * (car.speed >= 0 ? 1 : -1);
    const nx = car.pos.x + Math.sin(car.heading) * car.speed * dt;
    const nz = car.pos.z + Math.cos(car.heading) * car.speed * dt;
    // two-circle collision (front/rear)
    const fx = nx + Math.sin(car.heading) * 1.5, fz = nz + Math.cos(car.heading) * 1.5;
    const bx = nx - Math.sin(car.heading) * 1.5, bz = nz - Math.cos(car.heading) * 1.5;
    let hit = false;
    const f1 = collideCircle(this.city.buildings, fx, fz, 1.05);
    if (f1.x !== fx || f1.z !== fz) hit = true;
    const f2 = collideCircle(this.city.buildings, bx, bz, 1.05);
    if (f2.x !== bx || f2.z !== bz) hit = true;
    if (hit) {
      const impact = Math.abs(car.speed);
      car.speed *= 0.35;
      if (impact > 9) {
        car.health -= (impact - 9) * 1.6;
        this.sound('crash');
        this.toast('Crash!');
        if (car.health <= 0) this.wreckCar(car);
      }
    } else {
      car.pos.x = nx; car.pos.z = nz;
    }
    // wheel spin + visual steer
    const spin = car.speed * dt / 0.38;
    for (const w of car.wheels) w.rotation.x += spin;
    car.wheels[0].rotation.y = car.steer * 0.9;
    car.wheels[1].rotation.y = car.steer * 0.9;
    car.mesh.position.set(car.pos.x, 0, car.pos.z);
    car.mesh.rotation.y = car.heading;
    // engine sound pitch
    this.sound('engine', { speed: Math.abs(car.speed) / 38 });
  }

  wreckCar(car) {
    car.health = 0;
    this.sound('explosion');
    this.toast('Car wrecked!');
    if (car === this.playerCar) {
      car.kind = 'wreck';
      this.exitCar(true);
      this.damagePlayer(25);
    } else {
      car.kind = 'wreck';
      car.targetSpeed = 0; car.speed = 0;
    }
  }

  enterCar(car) {
    this.playerCar = car;
    car.kind = 'player';
    this.player.mesh.group.visible = false;
    if (!car.stolen) {
      car.stolen = true;
      if (this.time - this.lastStealAt > 20 && this.wanted < 3) {
        this.lastStealAt = this.time;
        this.setWanted(this.wanted + 1);
        this.toast('Grand theft auto! Wanted level up');
        this.sound('siren');
      }
    }
    this.sound('door');
  }

  exitCar(wrecked = false) {
    if (!this.playerCar) return;
    const car = this.playerCar;
    this.playerCar = null;
    const side = 2.4;
    const px = car.pos.x + Math.cos(car.heading) * side;
    const pz = car.pos.z - Math.sin(car.heading) * side;
    const fixed = collideCircle(this.city.buildings, px, pz, 0.6);
    this.player.pos.x = fixed.x; this.player.pos.z = fixed.z;
    this.player.heading = car.heading;
    this.player.mesh.group.visible = true;
    this.player.mesh.group.position.set(fixed.x, 0, fixed.z);
    if (!wrecked) car.kind = 'parked';
  }

  damagePlayer(n) {
    this.health = clamp(this.health - n, 0, 100);
    this.hooks.onHealth && this.hooks.onHealth(this.health);
    if (this.health <= 0 && !this.gameOver) {
      this.gameOver = true;
      this.hooks.onWasted && this.hooks.onWasted();
    }
  }

  // ---------- traffic ----------
  updateTraffic(dt) {
    const focus = this.focusPos();
    for (const car of this.cars) {
      if (car.kind !== 'traffic') continue;
      // keep density near the player: recycle far cars
      const d = Math.hypot(car.pos.x - focus.x, car.pos.z - focus.z);
      if (d > 260) {
        const p = roadPoint(this.rng, focus, 90);
        car.pos.x = p.x; car.pos.z = p.z;
        car.wp = this.nextWaypoint(car);
        car.speed = 8;
      }
      // steer toward waypoint
      const dx = car.wp.x - car.pos.x, dz = car.wp.z - car.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 5) { car.wp = this.nextWaypoint(car); continue; }
      const targetHeading = Math.atan2(dx, dz);
      let dh = targetHeading - car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      car.heading += clamp(dh, -1.8 * dt, 1.8 * dt);
      // slow for a car ahead
      let blocked = false;
      for (const other of this.cars) {
        if (other === car || other.kind === 'wreck') continue;
        const ox = other.pos.x - car.pos.x, oz = other.pos.z - car.pos.z;
        const od = Math.hypot(ox, oz);
        if (od < 11 && od > 0.1) {
          const dot = (ox * Math.sin(car.heading) + oz * Math.cos(car.heading)) / od;
          if (dot > 0.75) { blocked = true; break; }
        }
      }
      car.speed = lerp(car.speed, blocked ? 0 : car.targetSpeed, 1 - Math.exp(-2 * dt));
      car.pos.x += Math.sin(car.heading) * car.speed * dt;
      car.pos.z += Math.cos(car.heading) * car.speed * dt;
      const fixed = collideCircle(this.city.buildings, car.pos.x, car.pos.z, 1.3);
      car.pos.x = fixed.x; car.pos.z = fixed.z;
      car.mesh.position.set(car.pos.x, 0, car.pos.z);
      car.mesh.rotation.y = car.heading;
      const spin = car.speed * dt / 0.38;
      for (const w of car.wheels) w.rotation.x += spin;
      // player collision with traffic
      if (this.playerCar) {
        const pc = this.playerCar;
        const dd = Math.hypot(pc.pos.x - car.pos.x, pc.pos.z - car.pos.z);
        if (dd < 3.6) {
          const push = (3.6 - dd) / 2;
          const nx = (pc.pos.x - car.pos.x) / (dd || 1), nz = (pc.pos.z - car.pos.z) / (dd || 1);
          pc.pos.x += nx * push; pc.pos.z += nz * push;
          car.pos.x -= nx * push; car.pos.z -= nz * push;
          const impact = Math.abs(pc.speed - car.speed);
          if (impact > 6) {
            pc.health -= (impact - 6) * 0.9;
            this.sound('crash');
            if (pc.health <= 0) this.wreckCar(pc);
          }
          pc.speed *= 0.82;
        }
      } else {
        // on foot vs traffic: run over check handled in peds section; traffic vs player
        const pp = this.player.pos;
        const dd = Math.hypot(pp.x - car.pos.x, pp.z - car.pos.z);
        if (dd < 2.2 && car.speed > 3) {
          this.damagePlayer(20);
          this.toast('Hit by a car!');
          this.sound('thud');
          car.speed = 0;
        }
      }
    }
  }

  // ---------- pedestrians ----------
  updatePeds(dt) {
    for (const ped of this.peds) {
      if (ped.down > 0) {
        ped.down -= dt;
        if (ped.down <= 0) {
          ped.mesh.group.rotation.x = 0;
          ped.mesh.group.position.y = 0;
          // run away
          ped.speed = 5;
          ped.wp = this.nextPedWaypoint(ped);
        }
        continue;
      }
      const dx = ped.wp.x - ped.pos.x, dz = ped.wp.z - ped.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 3) { ped.wp = this.nextPedWaypoint(ped); ped.speed = range(this.rng, 1.2, 2.2); continue; }
      const targetHeading = Math.atan2(dx, dz);
      let dh = targetHeading - ped.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      ped.heading += clamp(dh, -3 * dt, 3 * dt);
      ped.pos.x += Math.sin(ped.heading) * ped.speed * dt;
      ped.pos.z += Math.cos(ped.heading) * ped.speed * dt;
      const fixed = collideCircle(this.city.buildings, ped.pos.x, ped.pos.z, 0.5);
      ped.pos.x = fixed.x; ped.pos.z = fixed.z;
      ped.phase += dt * ped.speed * 3.2;
      const swing = Math.sin(ped.phase) * 0.7;
      ped.mesh.legL.rotation.x = swing;
      ped.mesh.legR.rotation.x = -swing;
      ped.mesh.armL.rotation.x = -swing * 0.7;
      ped.mesh.armR.rotation.x = swing * 0.7;
      ped.mesh.group.position.set(ped.pos.x, 0, ped.pos.z);
      ped.mesh.group.rotation.y = ped.heading;
      // run over by the player's car
      if (this.playerCar) {
        const dd = Math.hypot(ped.pos.x - this.playerCar.pos.x, ped.pos.z - this.playerCar.pos.z);
        if (dd < 2.4 && Math.abs(this.playerCar.speed) > 5) this.knockPed(ped, 'run over');
      }
    }
  }

  // ---------- police ----------
  updatePolice(dt) {
    const focus = this.focusPos();
    const want = this.wanted > 0 ? Math.min(this.wanted + 1, 5) : 0;
    // spawn / despawn to match
    while (this.police.length < want) {
      const p = roadPoint(this.rng, focus, 70);
      const { group, wheels, lightBar } = buildCar(0x1a1a22, true);
      const car = { mesh: group, wheels, lightBar, pos: { x: p.x, z: p.z }, heading: 0, speed: 0, kind: 'police', health: 100, flash: 0 };
      this.scene.add(group);
      this.police.push(car);
      this.cars.push(car);
    }
    while (this.police.length > want) {
      const car = this.police.pop();
      const i = this.cars.indexOf(car);
      if (i >= 0) this.cars.splice(i, 1);
      this.scene.remove(car.mesh);
    }
    let anyNear = false;
    for (const car of this.police) {
      car.flash += dt;
      if (car.lightBar) {
        const on = Math.floor(car.flash * 6) % 2 === 0;
        car.lightBar.children[0].material.color.setHex(on ? 0xff2020 : 0x881010);
        car.lightBar.children[1].material.color.setHex(on ? 0x101088 : 0x2040ff);
      }
      const dx = focus.x - car.pos.x, dz = focus.z - car.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 70) anyNear = true;
      const targetHeading = Math.atan2(dx, dz);
      let dh = targetHeading - car.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      car.heading += clamp(dh, -2.6 * dt, 2.6 * dt);
      const targetSpeed = dist > 90 ? 40 : dist > 25 ? 34 : 26;
      car.speed = lerp(car.speed, targetSpeed, 1 - Math.exp(-1.5 * dt));
      car.pos.x += Math.sin(car.heading) * car.speed * dt;
      car.pos.z += Math.cos(car.heading) * car.speed * dt;
      const fixed = collideCircle(this.city.buildings, car.pos.x, car.pos.z, 1.3);
      car.pos.x = fixed.x; car.pos.z = fixed.z;
      car.mesh.position.set(car.pos.x, 0, car.pos.z);
      car.mesh.rotation.y = car.heading;
      const spin = car.speed * dt / 0.38;
      for (const w of car.wheels) w.rotation.x += spin;
      // ram the player
      if (this.playerCar) {
        const pc = this.playerCar;
        const dd = Math.hypot(pc.pos.x - car.pos.x, pc.pos.z - car.pos.z);
        if (dd < 3.6) {
          const nx = (pc.pos.x - car.pos.x) / (dd || 1), nz = (pc.pos.z - car.pos.z) / (dd || 1);
          pc.pos.x += nx * 1.2 * dt * 10; pc.pos.z += nz * 1.2 * dt * 10;
          pc.health -= 6 * dt;
          pc.speed *= 0.96;
          this.sound('crash');
          if (pc.health <= 0) this.wreckCar(pc);
        }
      } else {
        const pp = this.player.pos;
        const dd = Math.hypot(pp.x - car.pos.x, pp.z - car.pos.z);
        if (dd < 4 && this.player.speed < 1.5) {
          this.bustedTimer += dt;
          if (this.bustedTimer > 2.5 && !this.gameOver) {
            this.gameOver = true;
            this.hooks.onBusted && this.hooks.onBusted();
          }
        } else if (dd < 4) {
          // cop bumps the player on foot
          this.damagePlayer(12 * dt);
          this.player.pos.x += (pp.x - car.pos.x) / (dd || 1) * 6 * dt;
          this.player.pos.z += (pp.z - car.pos.z) / (dd || 1) * 6 * dt;
        } else {
          this.bustedTimer = Math.max(0, this.bustedTimer - dt);
        }
      }
    }
    // wanted decay when no police can see you
    if (this.wanted > 0) {
      if (!anyNear) {
        this.wantedTimer += dt;
        const need = this.missionIdx === 2 && this.missionActive ? 8 : 12;
        if (this.wantedTimer > need) {
          this.wantedTimer = 0;
          this.setWanted(this.wanted - 1);
          if (this.wanted === 0) this.toast('You lost the cops. Heat is off.');
        }
      } else {
        this.wantedTimer = 0;
      }
    }
    if (this.wanted > 0 && Math.floor(this.time * 2) !== Math.floor((this.time - dt) * 2)) {
      this.sound('siren', { quiet: true });
    }
  }

  // ---------- missions ----------
  startMissions(startIdx = 0) {
    if (startIdx >= MISSIONS.length) { this.storyDone = true; this.missionActive = false; return; }
    this.missionActive = true;
    this.missionIdx = startIdx;
    this.stageIdx = 0;
    this.stageTimer = 0;
    this.holdTimer = 0;
    const m = MISSIONS[startIdx];
    this.phone(m.from, m.intro);
    if (m.onStart) m.onStart(this);
  }

  currentMission() {
    if (!this.missionActive || this.storyDone) return null;
    return MISSIONS[this.missionIdx] || null;
  }

  currentStage() {
    const m = this.currentMission();
    return m ? m.stages[this.stageIdx] : null;
  }

  objectiveText() {
    if (this.storyDone) return 'Story complete — Vice Bay is yours. Free roam!';
    const m = this.currentMission();
    if (!m) return 'Press M to start the story.';
    const s = m.stages[this.stageIdx];
    let t = `${m.name}: ${s.text}`;
    if (s.target) {
      const d = Math.round(this.distTo(s.target.x, s.target.z));
      t += `  —  ${d}m`;
    }
    if (s.timeLimit) t += `  —  ${Math.max(0, Math.ceil(s.timeLimit - this.stageTimer))}s`;
    if (s.holdSeconds) t += `  —  hold ${Math.max(0, s.holdSeconds - Math.floor(this.holdTimer))}s`;
    return t;
  }

  updateMissions(dt) {
    if (!this.missionActive || this.storyDone) return;
    const m = MISSIONS[this.missionIdx];
    if (!m) { this.storyDone = true; return; }
    const s = m.stages[this.stageIdx];
    if (!s) return;
    this.stageTimer += dt;
    // hold-to-grab stages
    if (s.holdSeconds) {
      const near = this.distTo(s.target.x, s.target.z) < s.radius;
      this.holdTimer = near ? this.holdTimer + dt : 0;
    }
    // timeout resets to stage 0
    if (s.timeLimit && this.stageTimer > s.timeLimit) {
      this.stageIdx = 0; this.stageTimer = 0; this.holdTimer = 0;
      if (s.onTimeout) s.onTimeout(this);
      return;
    }
    if (s.check(this)) {
      this.stageIdx += 1;
      this.stageTimer = 0; this.holdTimer = 0;
      if (this.stageIdx < m.stages.length) {
        const next = m.stages[this.stageIdx];
        if (next.onEnter) next.onEnter(this);
      } else {
        // mission complete
        this.addCash(m.reward);
        this.toast(`${m.name} COMPLETE  +$${m.reward}`);
        this.sound('mission');
        this.phone(m.from, m.complete);
        this.missionIdx += 1;
        this.stageIdx = 0;
        this.hooks.onMission && this.hooks.onMission(m.name);
        if (this.missionIdx >= MISSIONS.length) {
          this.storyDone = true;
          this.addCash(STORY_COMPLETE_BONUS);
          this.toast(`STORY COMPLETE  +$${STORY_COMPLETE_BONUS}`);
          this.phone('MAMA ROSA', 'Vice Bay is yours now, Danny. Free roam — the city remembers its king.');
        } else {
          const nm = MISSIONS[this.missionIdx];
          setTimeout(() => this.phone(nm.from, nm.intro), 2500);
          if (nm.onStart) nm.onStart(this);
        }
      }
    }
    // beacon follows the current stage target
    const stage = this.currentStage();
    if (stage && stage.target) {
      this.beacon.visible = true;
      this.beaconRing.visible = true;
      this.beacon.position.x = stage.target.x;
      this.beacon.position.z = stage.target.z;
      this.beaconRing.position.x = stage.target.x;
      this.beaconRing.position.z = stage.target.z;
      const pulse = 0.22 + 0.1 * Math.sin(this.time * 4);
      this.beacon.material.opacity = pulse;
      this.beaconRing.scale.setScalar(1 + 0.15 * Math.sin(this.time * 4));
    } else {
      this.beacon.visible = false;
      this.beaconRing.visible = false;
    }
  }

  // ---------- car entry ----------
  updateNearCar(input) {
    if (this.playerCar) {
      if (input.enter) {
        this.exitCar(false);
        this.sound('door');
      }
      this.nearCar = null;
      return;
    }
    let best = null, bestD = 3.6;
    for (const car of this.cars) {
      if (car.kind === 'police' || car.kind === 'wreck') continue;
      const d = Math.hypot(car.pos.x - this.player.pos.x, car.pos.z - this.player.pos.z);
      if (d < bestD) { bestD = d; best = car; }
    }
    this.nearCar = best;
    if (best && input.enter) {
      this.enterCar(best);
    }
  }

  // ---------- main update ----------
  update(dt, input, camYaw) {
    if (this.gameOver) return;
    dt = Math.min(dt, 0.05);
    this.time += dt;
    this.clockMin += dt * 0.6; // 1 real second ~ 0.6 game-minutes
    if (this.playerCar) this.updatePlayerCar(dt, input);
    else this.updatePlayer(dt, input, camYaw);
    this.updateNearCar(input);
    this.updateTraffic(dt);
    this.updatePeds(dt);
    this.updatePolice(dt);
    this.updateMissions(dt);
    // parked cars sit still; sync meshes
    for (const car of this.cars) {
      if (car.kind === 'parked' || car.kind === 'wreck' || car.kind === 'player') {
        car.mesh.position.set(car.pos.x, 0, car.pos.z);
        car.mesh.rotation.y = car.heading;
      }
    }
  }

  clockString() {
    const total = Math.floor(this.clockMin) % (24 * 60);
    const h = Math.floor(total / 60), m = total % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
}
