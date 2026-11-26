// Procedural terrain for Awan Valley: one height function shared by the mesh,
// the physics (ground collisions) and the ring placement, so what you see is
// exactly what you can hit. Deterministic: no Math.random anywhere here.
import { WORLD } from './config.js';

/** Small deterministic hash-noise in [-1, 1] from integer grid coords. */
export function hashNoise(ix, iz) {
  let n = (ix * 374761393 + iz * 668265263) | 0;
  n = (n ^ (n >> 13)) | 0;
  n = Math.imul(n, 1274126177);
  n = (n ^ (n >> 16)) >>> 0;
  return n / 2147483648 - 1;
}

/** Smooth interpolation helper. */
export function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Height of the ground in metres at world (x, z). */
export function terrainHeight(x, z) {
  // Rolling valley floor: two long swells plus finer ripples.
  let h = 18 * Math.sin(x * 0.0016 + 1.7) * Math.cos(z * 0.0013 + 0.6)
    + 9 * Math.sin(x * 0.004 + 0.3) * Math.sin(z * 0.0035 + 2.1)
    + 4 * Math.sin(x * 0.011 + 0.8) * Math.cos(z * 0.009 + 1.2);
  // Mountains rise toward the edges of the map.
  const r = Math.max(Math.abs(x), Math.abs(z)) / WORLD.halfSize;
  const edge = Math.max(0, r - 0.55) / 0.45;
  h += edge * edge * 170 * (0.7 + 0.3 * Math.sin(x * 0.002 + 3) * Math.cos(z * 0.0021 + 1));
  // Lake basin south-west: a dip that drops below the water level.
  const lakeDist = Math.hypot(x + 1250, z - 950);
  if (lakeDist < 460) h -= (1 - lakeDist / 460) * 30;
  // Flatten the runway strip so landings read cleanly.
  const runwayBlend = smoothstep(WORLD.runwayHalfWidth + 60, WORLD.runwayHalfWidth, Math.abs(x))
    * smoothstep(WORLD.runwayHalfLength + 80, WORLD.runwayHalfLength, Math.abs(z));
  h = h * (1 - runwayBlend) + WORLD.runwayAltitude * runwayBlend;
  return h;
}

/** True when (x, z) is over open water (terrain under the water level). */
export function isWater(x, z) {
  return terrainHeight(x, z) < WORLD.waterLevel;
}

/** True when (x, z) is on the runway strip. */
export function isRunway(x, z) {
  return Math.abs(x) <= WORLD.runwayHalfWidth && Math.abs(z) <= WORLD.runwayHalfLength;
}

/**
 * Build the terrain mesh, the lake surface, the runway, trees and rocks, and
 * add them to `scene`. Colours are vertex colours on the terrain so the
 * valley reads green, the high ground brown/grey, and the beach sandy.
 */
export function buildWorld(scene, THREE) {
  const size = WORLD.halfSize * 2;
  const segments = 180;
  const geo = new THREE.PlaneGeometry(size, size, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const green = new THREE.Color(0x4d8a3f);
  const meadow = new THREE.Color(0x6fae4e);
  const sand = new THREE.Color(0xc9b078);
  const rock = new THREE.Color(0x8a7f74);
  const snow = new THREE.Color(0xe8e8e8);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = terrainHeight(x, z);
    pos.setY(i, h);
    if (h < WORLD.waterLevel + 1.5) tmp.copy(sand);
    else if (h < 55) tmp.copy(green).lerp(meadow, hashNoise(Math.floor(x / 90), Math.floor(z / 90)) * 0.5 + 0.5);
    else if (h < 110) tmp.copy(rock).lerp(green, 0.35);
    else if (h < 165) tmp.copy(rock);
    else tmp.copy(snow).lerp(rock, 0.3);
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const terrain = new THREE.Mesh(
    geo,
    new THREE.MeshLambertMaterial({ vertexColors: true }),
  );
  scene.add(terrain);

  // Lake / sea surface: a flat translucent blue sheet at the water level.
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshLambertMaterial({ color: 0x2f6fb2, transparent: true, opacity: 0.82 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = WORLD.waterLevel;
  scene.add(water);

  buildRunway(scene, THREE);
  buildTreesAndRocks(scene, THREE);
  buildClouds(scene, THREE);
  buildSun(scene, THREE);
}

/** Runway: dark strip, white centre dashes, threshold bars and edge lights. */
function buildRunway(scene, THREE) {
  const group = new THREE.Group();
  const y = WORLD.runwayAltitude + 0.15;
  const strip = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.runwayHalfWidth * 2, WORLD.runwayHalfLength * 2),
    new THREE.MeshLambertMaterial({ color: 0x3a3f46 }),
  );
  strip.rotation.x = -Math.PI / 2;
  strip.position.y = y;
  group.add(strip);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5f2e8 });
  for (let z = -WORLD.runwayHalfLength + 40; z < WORLD.runwayHalfLength - 20; z += 60) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 26), dashMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(0, y + 0.05, z);
    group.add(dash);
  }
  // Threshold bars at both ends.
  for (const zEnd of [-WORLD.runwayHalfLength + 12, WORLD.runwayHalfLength - 12]) {
    for (let k = -2; k <= 2; k += 1) {
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(3, 14), dashMat);
      bar.rotation.x = -Math.PI / 2;
      bar.position.set(k * 6.5, y + 0.05, zEnd);
      group.add(bar);
    }
  }
  // Edge lights: small warm dots down both sides.
  const lightGeo = new THREE.SphereGeometry(0.9, 8, 6);
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffc861 });
  for (let z = -WORLD.runwayHalfLength; z <= WORLD.runwayHalfLength; z += 40) {
    for (const xSide of [-WORLD.runwayHalfWidth - 2, WORLD.runwayHalfWidth + 2]) {
      const light = new THREE.Mesh(lightGeo, lightMat);
      light.position.set(xSide, y + 1, z);
      group.add(light);
    }
  }
  scene.add(group);
}

/** Scatter low-poly trees (cones) and rocks on flat, dry, non-runway ground. */
function buildTreesAndRocks(scene, THREE) {
  const treeCount = 340;
  const trunkGeo = new THREE.CylinderGeometry(0.7, 1.0, 4, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2f });
  const crownGeo = new THREE.ConeGeometry(4.2, 13, 7);
  const crownMat = new THREE.MeshLambertMaterial({ color: 0x2f6b2a });
  const crownMat2 = new THREE.MeshLambertMaterial({ color: 0x3a7d33 });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
  const crowns = new THREE.InstancedMesh(crownGeo, crownMat, treeCount);
  const crowns2 = new THREE.InstancedMesh(crownGeo, crownMat2, treeCount);
  const dummy = new THREE.Object3D();
  let placed = 0;
  let guard = 0;
  while (placed < treeCount && guard < treeCount * 40) {
    guard += 1;
    const gx = Math.floor(hashNoise(guard, 7) * 997);
    const gz = Math.floor(hashNoise(guard, 13) * 997);
    const x = gx * 2;
    const z = gz * 2;
    const h = terrainHeight(x, z);
    if (h < WORLD.waterLevel + 2 || h > 90 || isRunway(x, z)) continue;
    // Keep the runway approach clear so the landing reads.
    if (Math.abs(x) < 90 && Math.abs(z) < 420) continue;
    const s = 0.8 + Math.abs(hashNoise(gx, gz)) * 0.9;
    dummy.position.set(x, h + 2 * s, z);
    dummy.scale.setScalar(s);
    dummy.rotation.y = hashNoise(gx, gz) * Math.PI;
    dummy.updateMatrix();
    trunks.setMatrixAt(placed, dummy.matrix);
    dummy.position.y = h + (2 + 6) * s;
    dummy.updateMatrix();
    (placed % 2 === 0 ? crowns : crowns2).setMatrixAt(placed, dummy.matrix);
    placed += 1;
  }
  trunks.count = placed;
  crowns.count = placed;
  crowns2.count = placed;
  scene.add(trunks);
  scene.add(crowns);
  scene.add(crowns2);

  const rockCount = 90;
  const rockGeo = new THREE.DodecahedronGeometry(3.2, 0);
  const rockMat = new THREE.MeshLambertMaterial({ color: 0x7d7468 });
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
  for (let i = 0; i < rockCount; i += 1) {
    const x = hashNoise(i, 21) * 1750;
    const z = hashNoise(i, 29) * 1750;
    const h = terrainHeight(x, z);
    dummy.position.set(x, Math.max(h, WORLD.waterLevel) + 0.5, z);
    dummy.scale.set(0.6 + Math.abs(hashNoise(i, 31)) * 1.6, 0.5 + Math.abs(hashNoise(i, 37)) * 0.9, 0.6 + Math.abs(hashNoise(i, 41)) * 1.6);
    dummy.rotation.set(hashNoise(i, 43), hashNoise(i, 47) * Math.PI, 0);
    dummy.updateMatrix();
    rocks.setMatrixAt(i, dummy.matrix);
  }
  scene.add(rocks);
}

/** Drifting low-poly clouds: clusters of white flattened spheres. */
function buildClouds(scene, THREE) {
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 });
  const puffGeo = new THREE.SphereGeometry(1, 10, 8);
  const clouds = new THREE.Group();
  clouds.name = 'clouds';
  for (let i = 0; i < 22; i += 1) {
    const cloud = new THREE.Group();
    const puffs = 3 + Math.floor(Math.abs(hashNoise(i, 53)) * 3);
    for (let p = 0; p < puffs; p += 1) {
      const puff = new THREE.Mesh(puffGeo, cloudMat);
      puff.position.set(p * 14 - puffs * 7 + hashNoise(i, 60 + p) * 6, hashNoise(i, 70 + p) * 4, hashNoise(i, 80 + p) * 8);
      puff.scale.set(16 + Math.abs(hashNoise(i, 90 + p)) * 10, 5 + Math.abs(hashNoise(i, 95 + p)) * 3, 10 + Math.abs(hashNoise(i, 99 + p)) * 6);
      cloud.add(puff);
    }
    cloud.position.set(hashNoise(i, 101) * 1800, 240 + Math.abs(hashNoise(i, 103)) * 120, hashNoise(i, 107) * 1800);
    clouds.add(cloud);
  }
  scene.add(clouds);
}

/** A bright sun disc plus the scene's key light. */
function buildSun(scene, THREE) {
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(60, 32),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, fog: false }),
  );
  sun.position.set(-1400, 900, -1600);
  sun.lookAt(0, 0, 0);
  scene.add(sun);
  const light = new THREE.DirectionalLight(0xfff1d6, 1.25);
  light.position.set(-900, 1200, -700);
  scene.add(light);
  scene.add(new THREE.AmbientLight(0xbfd9ff, 0.75));
}
