// Vice Bay city: procedural ground texture, merged buildings, palms, lamps, water, sunset sky.
// All original art, no Rockstar assets. Seeded so every run (and every screenshot) matches.
import * as THREE from 'three';
import { mulberry32, pick, range, rangeInt, clamp, mergeGeometries } from './util.js';

export const PITCH = 72;          // road centre spacing
export const ROAD_W = 16;
export const ROAD_CENTERS = [-288, -216, -144, -72, 0, 72, 144, 216, 288];
export const BOUNDS = 296;        // drivable city edge
export const WORLD = 640;         // ground plane size

const PALETTE = [0xc9a689, 0xa8b8c4, 0xd8c9a8, 0xb8a8c8, 0xe8d8c8, 0x98a898, 0xc48888, 0x8898b8, 0xd8b088, 0x9fb8a8];

function makeWindowTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#dcdcdc'; g.fillRect(0, 0, 128, 128);
  for (let y = 6; y < 122; y += 16) for (let x = 6; x < 122; x += 16) {
    const lit = Math.random() < 0.16;
    g.fillStyle = lit ? '#ffd27a' : '#232838';
    g.fillRect(x, y, 9, 10);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeSignTexture(lines, bg, fg) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 512, 128);
  g.fillStyle = fg; g.font = '900 56px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(lines, 256, 66);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function groundTexture(rng) {
  const S = 2048, PX = S / WORLD; // px per world unit
  const c = document.createElement('canvas'); c.width = S; c.height = S;
  const g = c.getContext('2d');
  const X = (x) => (x + WORLD / 2) * PX;
  const Z = (z) => (z + WORLD / 2) * PX;
  g.fillStyle = '#83878e'; g.fillRect(0, 0, S, S); // sidewalk concrete base
  // block bases
  for (let bx = -4; bx <= 3; bx++) for (let bz = -4; bz <= 3; bz++) {
    const cx = (bx + 0.5) * PITCH, cz = (bz + 0.5) * PITCH;
    g.fillStyle = '#8d9197';
    g.fillRect(X(cx - 28), Z(cz - 28), 56 * PX, 56 * PX);
  }
  // park block (bx=-1,bz=-1) -> green
  g.fillStyle = '#4f7d43';
  g.fillRect(X(-36 - 28), Z(-36 - 28), 56 * PX, 56 * PX);
  g.fillStyle = '#6a9a58';
  g.fillRect(X(-36 - 14), Z(-36 - 14), 28 * PX, 28 * PX);
  // parking lot block (bx=2,bz=-2)
  g.fillStyle = '#3a3d44';
  g.fillRect(X(180 - 28), Z(-180 - 28), 56 * PX, 56 * PX);
  g.strokeStyle = '#e8e8e8'; g.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    g.beginPath(); g.moveTo(X(180 - 24 + i * 9), Z(-180 - 20)); g.lineTo(X(180 - 24 + i * 9), Z(-180 - 2)); g.stroke();
    g.beginPath(); g.moveTo(X(180 - 24 + i * 9), Z(-180 + 4)); g.lineTo(X(180 - 24 + i * 9), Z(-180 + 22)); g.stroke();
  }
  // beach sand east of x=296
  g.fillStyle = '#d9c08a'; g.fillRect(X(296), 0, (WORLD / 2 - 296) * PX, S);
  g.fillStyle = '#c9b078'; g.fillRect(X(296), 0, 3 * PX, S); // boardwalk edge
  // roads
  g.fillStyle = '#494d56';
  for (const r of ROAD_CENTERS) {
    g.fillRect(X(r - ROAD_W / 2), 0, ROAD_W * PX, S);
    g.fillRect(0, Z(r - ROAD_W / 2), S, ROAD_W * PX);
  }
  // centre dashes
  g.fillStyle = '#d8b23a';
  for (const r of ROAD_CENTERS) {
    for (let t = -300; t < 300; t += 12) {
      g.fillRect(X(r - 0.4), Z(t), 0.8 * PX, 5 * PX);
      g.fillRect(X(t), Z(r - 0.4), 5 * PX, 0.8 * PX);
    }
  }
  // crosswalks at intersections
  g.fillStyle = '#e8e8e8';
  for (const rx of ROAD_CENTERS) for (const rz of ROAD_CENTERS) {
    for (let i = -3; i <= 3; i++) {
      g.fillRect(X(rx + i * 2.2 - 0.7), Z(rz - ROAD_W / 2 - 1.5), 1.4 * PX, 3 * PX);
      g.fillRect(X(rx + i * 2.2 - 0.7), Z(rz + ROAD_W / 2 - 1.5), 1.4 * PX, 3 * PX);
      g.fillRect(X(rx - ROAD_W / 2 - 1.5), Z(rz + i * 2.2 - 0.7), 3 * PX, 1.4 * PX);
      g.fillRect(X(rx + ROAD_W / 2 - 1.5), Z(rz + i * 2.2 - 0.7), 3 * PX, 1.4 * PX);
    }
  }
  // pier (east, at z=-108)
  g.fillStyle = '#8a6a48'; g.fillRect(X(320), Z(-108 - 7), 62 * PX, 14 * PX);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function boxAt(w, h, d, x, y, z, color, uvScale = 9) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const uv = geo.attributes.uv;
  // face order: +x,-x (d x h), +y,-y (w x d), +z,-z (w x h)
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let i = 0; i < uv.count; i++) {
    const f = Math.floor(i / 4);
    uv.setXY(i, uv.getX(i) * dims[f][0] / uvScale, uv.getY(i) * dims[f][1] / uvScale);
  }
  const col = new THREE.Color(color);
  const colors = new Float32Array(uv.count * 3);
  for (let i = 0; i < uv.count; i++) {
    const f = Math.floor(i / 4);
    const m = f === 2 ? 0.55 : (f === 0 || f === 1 ? 0.85 : 1); // roof darker, sides shaded
    colors[i * 3] = col.r * m; colors[i * 3 + 1] = col.g * m; colors[i * 3 + 2] = col.b * m;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.translate(x, y, z);
  return geo;
}

function paintGeo(geo, color) {
  const col = new THREE.Color(color);
  const n = geo.attributes.position.count;
  const colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

export function createCity(scene, seed) {
  const rng = mulberry32(seed);
  const group = new THREE.Group();
  scene.add(group);

  // ---- sky dome (sunset gradient) ----
  const skyGeo = new THREE.SphereGeometry(1100, 24, 12);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {},
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec3 vP;
      void main(){
        float h = normalize(vP).y;
        vec3 top = vec3(0.16,0.10,0.35);
        vec3 mid = vec3(0.95,0.45,0.28);
        vec3 hor = vec3(1.0,0.72,0.42);
        vec3 c = h > 0.25 ? mix(mid, top, smoothstep(0.25,0.75,h)) : mix(hor, mid, smoothstep(-0.05,0.25,h));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  group.add(new THREE.Mesh(skyGeo, skyMat));
  scene.fog = new THREE.Fog(0xe8895a, 260, 1050);

  // ---- lights ----
  const sun = new THREE.DirectionalLight(0xffb36b, 1.9);
  sun.position.set(-320, 210, 140);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -330; sun.shadow.camera.right = 330;
  sun.shadow.camera.top = 330; sun.shadow.camera.bottom = -330;
  sun.shadow.camera.far = 1200; sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xff9a7a, 0x3a3a4a, 1.05));
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(46, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd76a, fog: false, toneMapped: false }),
  );
  sunDisc.position.set(-760, 150, -260);
  sunDisc.lookAt(0, 60, 0);
  group.add(sunDisc);

  // ---- ground ----
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD, WORLD),
    new THREE.MeshLambertMaterial({ map: groundTexture(rng) }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // ---- water (east) ----
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(260, 700),
    new THREE.MeshLambertMaterial({ color: 0x2a6a8a, transparent: true, opacity: 0.92 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(450, -0.4, 0);
  group.add(water);
  const water2 = new THREE.Mesh(
    new THREE.PlaneGeometry(260, 700),
    new THREE.MeshLambertMaterial({ color: 0x3a8ab0, transparent: true, opacity: 0.35 }),
  );
  water2.rotation.x = -Math.PI / 2;
  water2.position.set(450, -0.2, 0);
  group.add(water2);

  // ---- buildings ----
  const buildings = []; // {x0,z0,x1,z1,h}
  const geos = [];
  const propGeos = [];
  const isPark = (bx, bz) => bx === -1 && bz === -1;
  const isParking = (bx, bz) => bx === 2 && bz === -2;
  for (let bx = -4; bx <= 3; bx++) for (let bz = -4; bz <= 3; bz++) {
    if (isPark(bx, bz) || isParking(bx, bz)) continue;
    const cx = (bx + 0.5) * PITCH, cz = (bz + 0.5) * PITCH;
    const distC = Math.hypot(cx, cz);
    const beach = bx === 3;
    const downtown = distC < 130;
    for (let lx = -1; lx <= 1; lx += 2) for (let lz = -1; lz <= 1; lz += 2) {
      if (rng() < 0.22) continue; // empty lot
      const w = range(rng, 17, 24), d = range(rng, 17, 24);
      let h = range(rng, 10, 24);
      if (downtown) h = range(rng, 18, 58);
      if (beach) h = range(rng, 26, 72);
      const x = cx + lx * 13.5, z = cz + lz * 13.5;
      geos.push(boxAt(w, h, d, x, h / 2, z, pick(rng, PALETTE)));
      buildings.push({ x0: x - w / 2, z0: z - d / 2, x1: x + w / 2, z1: z + d / 2, h });
      // rooftop water tower sometimes
      if (rng() < 0.3) {
        const tw = new THREE.CylinderGeometry(2.2, 2.2, 4, 8);
        tw.translate(x + range(rng, -4, 4), h + 3.5, z + range(rng, -4, 4));
        propGeos.push(paintGeo(tw, 0x6a4a3a));
        const tc = new THREE.ConeGeometry(2.6, 2.4, 8);
        tc.translate(x, h + 6.5, z);
        propGeos.push(paintGeo(tc, 0x54402f));
      }
    }
  }
  // landmark: bank (tall, bx=0,bz=2) + hotel (beach, bx=3,bz=1)
  const bank = { x: 36, z: 180, w: 34, d: 26, h: 46 };
  geos.push(boxAt(bank.w, bank.h, bank.d, bank.x, bank.h / 2, bank.z, 0xd8cdb0));
  buildings.push({ x0: bank.x - bank.w / 2, z0: bank.z - bank.d / 2, x1: bank.x + bank.w / 2, z1: bank.z + bank.d / 2, h: bank.h });
  const hotel = { x: 252, z: 108, w: 30, d: 30, h: 66 };
  geos.push(boxAt(hotel.w, hotel.h, hotel.d, hotel.x, hotel.h / 2, hotel.z, 0xe8b8c8));
  buildings.push({ x0: hotel.x - hotel.w / 2, z0: hotel.z - hotel.d / 2, x1: hotel.x + hotel.w / 2, z1: hotel.z + hotel.d / 2, h: hotel.h });
  // plaza kiosk (Mama Rosa's corner store)
  geos.push(boxAt(10, 6, 8, -14, 3, -36, 0x7a3a5a));
  buildings.push({ x0: -19, z0: -40, x1: -9, z1: -32, h: 6 });

  const buildingMesh = new THREE.Mesh(
    mergeGeometries(geos),
    new THREE.MeshLambertMaterial({ map: makeWindowTexture(), vertexColors: true }),
  );
  buildingMesh.castShadow = true;
  buildingMesh.receiveShadow = true;
  group.add(buildingMesh);
  if (propGeos.length) {
    const props = new THREE.Mesh(mergeGeometries(propGeos), new THREE.MeshLambertMaterial({ vertexColors: true }));
    props.castShadow = true;
    group.add(props);
  }

  // signs
  function addSign(text, w, h, x, y, z, ry, bg, fg) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: makeSignTexture(text, bg, fg) }),
    );
    m.position.set(x, y, z); m.rotation.y = ry;
    group.add(m);
  }
  addSign('VICE BAY BANK', 30, 7.5, bank.x, bank.h - 4, bank.z - bank.d / 2 - 0.3, Math.PI, '#1a2a4a', '#ffd23e');
  addSign('VICE BAY HOTEL', 26, 6.5, hotel.x, hotel.h - 5, hotel.z - hotel.d / 2 - 0.3, Math.PI, '#7a2a4a', '#ffe9f2');
  addSign('MAMA ROSA', 9, 2.4, -14, 4.6, -36 - 4 - 0.2, Math.PI, '#2a1a3a', '#ffb3d9');

  // ---- plaza fountain (park block centre -36,-36) ----
  const fountain = new THREE.Mesh(
    new THREE.CylinderGeometry(7, 8, 1.6, 20),
    new THREE.MeshLambertMaterial({ color: 0x9aa4ae }),
  );
  fountain.position.set(-36, 0.8, -36);
  fountain.castShadow = true;
  group.add(fountain);
  const fwater = new THREE.Mesh(
    new THREE.CylinderGeometry(6.2, 6.2, 0.5, 20),
    new THREE.MeshLambertMaterial({ color: 0x4a9ac8 }),
  );
  fwater.position.set(-36, 1.5, -36);
  group.add(fwater);
  buildings.push({ x0: -44, z0: -44, x1: -28, z1: -28, h: 2 });

  // ---- palms ----
  const trunkGeos = [], frondGeos = [];
  function palm(x, z, s = 1) {
    const trunk = new THREE.CylinderGeometry(0.35 * s, 0.55 * s, 7 * s, 6);
    trunk.translate(x, 3.5 * s, z);
    // slight lean
    trunkGeos.push(paintGeo(trunk, 0x7a5a3a));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const fr = new THREE.ConeGeometry(0.9 * s, 4.2 * s, 4);
      fr.rotateZ(Math.PI / 2.6);
      fr.rotateY(a);
      fr.translate(x + Math.cos(a) * 1.6 * s, 7 * s, z + Math.sin(a) * 1.6 * s);
      frondGeos.push(paintGeo(fr, i % 2 ? 0x3a7a3a : 0x4a8a3a));
    }
  }
  // beach row + park + scattered sidewalk palms
  for (let z = -270; z <= 270; z += 36) palm(306, z + range(rng, -6, 6), range(rng, 0.9, 1.2));
  for (let i = 0; i < 10; i++) palm(-36 + range(rng, -24, 24), -36 + range(rng, -24, 24), range(rng, 0.8, 1.1));
  for (let i = 0; i < 46; i++) {
    const bx = rangeInt(rng, -4, 3), bz = rangeInt(rng, -4, 3);
    if (isPark(bx, bz)) continue;
    const cx = (bx + 0.5) * PITCH, cz = (bz + 0.5) * PITCH;
    const side = pick(rng, [0, 1, 2, 3]);
    const x = side === 0 ? cx - 30 : side === 1 ? cx + 30 : cx + range(rng, -26, 26);
    const z = side === 2 ? cz - 30 : side === 3 ? cz + 30 : cz + range(rng, -26, 26);
    palm(x, z, range(rng, 0.8, 1.15));
  }
  const palmMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const trunks = new THREE.Mesh(mergeGeometries(trunkGeos), palmMat);
  trunks.castShadow = true;
  group.add(trunks);
  group.add(new THREE.Mesh(mergeGeometries(frondGeos), palmMat));

  // ---- streetlights at intersections ----
  const poleGeos = [], lampGeos = [];
  for (const rx of ROAD_CENTERS) for (const rz of ROAD_CENTERS) {
    if (rng() < 0.4) continue;
    const x = rx + 10, z = rz + 10;
    const pole = new THREE.CylinderGeometry(0.18, 0.22, 7, 6);
    pole.translate(x, 3.5, z);
    poleGeos.push(paintGeo(pole, 0x3a3a42));
    const lamp = new THREE.SphereGeometry(0.55, 8, 6);
    lamp.translate(x, 7.2, z);
    lampGeos.push(paintGeo(lamp, 0xffe9a8));
  }
  group.add(new THREE.Mesh(mergeGeometries(poleGeos), new THREE.MeshLambertMaterial({ vertexColors: true })));
  group.add(new THREE.Mesh(mergeGeometries(lampGeos), new THREE.MeshBasicMaterial({ vertexColors: true })));

  // ---- pier (docks, east at z=-108): low boardwalk, top at y=0.25 so cars and
  // pedestrians can drive/walk onto it without clipping through the deck ----
  const pier = new THREE.Mesh(
    new THREE.BoxGeometry(62, 0.5, 14),
    new THREE.MeshLambertMaterial({ color: 0x8a6a48 }),
  );
  pier.position.set(351, 0, -108);
  pier.castShadow = true;
  pier.receiveShadow = true;
  group.add(pier);
  for (let i = 0; i < 5; i++) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 2.6, 6),
      new THREE.MeshLambertMaterial({ color: 0x6a4a30 }),
    );
    post.position.set(326 + i * 14, 0.6, -108 + (i % 2 ? 6 : -6));
    group.add(post);
  }
  // crates on the pier (with collision so cars can't drive through them).
  // Kept to the pier's edges so the centre lane stays clear for driving.
  for (let i = 0; i < 6; i++) {
    const cx = 330 + rng() * 40, cz = -108 + (rng() < 0.5 ? -4.8 : 4.8);
    const crate = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 2.4, 2.4),
      new THREE.MeshLambertMaterial({ color: pick(rng, [0xa8845a, 0x7a8a5a, 0x8a6a6a]) }),
    );
    crate.position.set(cx, 1.45, cz);
    crate.rotation.y = rng() * Math.PI;
    crate.castShadow = true;
    group.add(crate);
    buildings.push({ x0: cx - 1.3, z0: cz - 1.3, x1: cx + 1.3, z1: cz + 1.3, h: 3 });
  }

  // ---- beach umbrellas ----
  for (let i = 0; i < 8; i++) {
    const z = -240 + i * 68;
    const um = new THREE.Mesh(
      new THREE.ConeGeometry(3.2, 1.6, 8),
      new THREE.MeshLambertMaterial({ color: pick(rng, [0xff6a6a, 0xffd23e, 0x6ac8ff, 0xff9ad9]) }),
    );
    um.position.set(308, 2.6, z);
    group.add(um);
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 2.6, 6),
      new THREE.MeshLambertMaterial({ color: 0xdddddd }),
    );
    pole.position.set(308, 1.3, z);
    group.add(pole);
  }

  return {
    group, buildings, rng,
    landmarks: {
      plaza: { x: -36, z: -36 },
      bank: { x: 36, z: 180 },
      hotel: { x: 252, z: 108 },
      garage: { x: -180, z: -252 },
      safehouse: { x: -252, z: 252 },
      docks: { x: 356, z: -108 },
      parking: { x: 180, z: -180 },
    },
    spawn: { x: -8, z: 8 },
  };
}

/** Circle (radius r) vs building AABBs: push out, return corrected position. */
export function collideCircle(buildings, x, z, r) {
  for (const b of buildings) {
    const nx = clamp(x, b.x0, b.x1), nz = clamp(z, b.z0, b.z1);
    const dx = x - nx, dz = z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        x = nx + (dx / d) * r;
        z = nz + (dz / d) * r;
      } else {
        // centre inside box: push out along smallest penetration axis
        const pl = x - b.x0, pr = b.x1 - x, pt = z - b.z0, pb = b.z1 - z;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) x = b.x0 - r; else if (m === pr) x = b.x1 + r;
        else if (m === pt) z = b.z0 - r; else z = b.z1 + r;
      }
    }
  }
  // Beach (up to x=318) and the pier corridor (z -120..-96, up to x=380) are
  // reachable; the rest of the city is bounded at x=306.
  const maxX = (z > -120 && z < -96) ? 380 : 318;
  x = clamp(x, -BOUNDS, maxX);
  z = clamp(z, -BOUNDS, BOUNDS);
  return { x, z };
}

export function nearestRoadPoint(x, z) {
  // snap to the closest road centre line (for traffic/pedestrian lanes)
  let bx = ROAD_CENTERS[0], bz = ROAD_CENTERS[0];
  for (const r of ROAD_CENTERS) { if (Math.abs(x - r) < Math.abs(x - bx)) bx = r; if (Math.abs(z - r) < Math.abs(z - bz)) bz = r; }
  return { x: bx, z: bz };
}
