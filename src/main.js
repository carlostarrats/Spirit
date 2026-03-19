import { Renderer } from './renderer.js';
import { World } from './world.js';
import { terrainHeight } from './noise.js';

const canvas = document.getElementById('canvas');
const renderer = new Renderer(canvas);
const world = new World(42);

const SPEED = 4.5;
const EYE_HEIGHT = 1.6;
const FOV = Math.PI / 3;

let yaw = 0, pitch = -0.1;
let px = 0, pz = 0;
let lastTime = 0;
let worldUploaded = false;
let lastTerrainX = -999, lastTerrainZ = -999;
let lastGrassX = -999, lastGrassZ = -999;
let walkTarget = null;

const camera = { position: [0, 0, 0], target: [0, 0, 1] };
const keys = {};

document.addEventListener('keydown', e => { keys[e.code] = true; });
document.addEventListener('keyup', e => { keys[e.code] = false; });

// right-drag to rotate camera
let rightDrag = false, lastMX = 0, lastMY = 0;

canvas.addEventListener('mousedown', e => {
  if (e.button === 2) {
    rightDrag = true;
    lastMX = e.clientX;
    lastMY = e.clientY;
  }
});

window.addEventListener('mouseup', e => {
  if (e.button === 2) rightDrag = false;
});

canvas.addEventListener('mousemove', e => {
  if (rightDrag) {
    yaw -= (e.clientX - lastMX) * 0.004;
    pitch -= (e.clientY - lastMY) * 0.004;
    pitch = Math.max(-1.2, Math.min(1.2, pitch));
    lastMX = e.clientX;
    lastMY = e.clientY;
  }
});

canvas.addEventListener('contextmenu', e => e.preventDefault());

// click to move
canvas.addEventListener('click', e => {
  if (e.button !== 0) return;
  const rect = canvas.getBoundingClientRect();
  const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  const ndcY = 1 - ((e.clientY - rect.top) / rect.height) * 2;

  const ray = getMouseRay(ndcX, ndcY);
  const hit = raycastTerrain(camera.position, ray);
  if (hit) walkTarget = hit;
});

function getMouseRay(ndcX, ndcY) {
  const aspect = canvas.clientWidth / canvas.clientHeight;
  const tanFov = Math.tan(FOV / 2);
  const cosP = Math.cos(pitch), sinP = Math.sin(pitch);
  const cosY = Math.cos(yaw), sinY = Math.sin(yaw);

  const fwd = [sinY * cosP, sinP, cosY * cosP];
  const right = [cosY, 0, -sinY];
  const up = [-sinY * sinP, cosP, -cosY * sinP];

  const rx = fwd[0] + ndcX * tanFov * aspect * right[0] + ndcY * tanFov * up[0];
  const ry = fwd[1] + ndcX * tanFov * aspect * right[1] + ndcY * tanFov * up[1];
  const rz = fwd[2] + ndcX * tanFov * aspect * right[2] + ndcY * tanFov * up[2];
  const len = Math.sqrt(rx * rx + ry * ry + rz * rz);
  return [rx / len, ry / len, rz / len];
}

function raycastTerrain(origin, dir) {
  for (let t = 0.5; t < 120; t += 0.5) {
    const x = origin[0] + dir[0] * t;
    const y = origin[1] + dir[1] * t;
    const z = origin[2] + dir[2] * t;
    if (y <= terrainHeight(x, z)) {
      let lo = t - 0.5, hi = t;
      for (let i = 0; i < 8; i++) {
        const m = (lo + hi) / 2;
        const my = origin[1] + dir[1] * m;
        if (my <= terrainHeight(origin[0] + dir[0] * m, origin[2] + dir[2] * m)) hi = m; else lo = m;
      }
      const ft = (lo + hi) / 2;
      const fx = origin[0] + dir[0] * ft, fz = origin[2] + dir[2] * ft;
      return [fx, terrainHeight(fx, fz), fz];
    }
  }
  return null;
}

function lerpAngle(from, to, t) {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return from + d * t;
}

function frame(ts) {
  const time = ts * 0.001;
  const dt = Math.min(lastTime ? time - lastTime : 0.016, 0.05);
  lastTime = time;

  const dpr = Math.min(window.devicePixelRatio, 1.5);
  const w = Math.floor(canvas.clientWidth * dpr);
  const h = Math.floor(canvas.clientHeight * dpr);
  renderer.resize(w, h);

  // WASD movement
  const fwd = [Math.sin(yaw), 0, Math.cos(yaw)];
  const right = [Math.cos(yaw), 0, -Math.sin(yaw)];
  let mx = 0, mz = 0;
  if (keys['KeyW'] || keys['ArrowUp']) { mx += fwd[0]; mz += fwd[2]; }
  if (keys['KeyS'] || keys['ArrowDown']) { mx -= fwd[0]; mz -= fwd[2]; }
  if (keys['KeyA'] || keys['ArrowLeft']) { mx -= right[0]; mz -= right[2]; }
  if (keys['KeyD'] || keys['ArrowRight']) { mx += right[0]; mz += right[2]; }

  const mLen = Math.sqrt(mx * mx + mz * mz);
  if (mLen > 0) {
    walkTarget = null; // WASD overrides click-to-move
    const spd = (keys['ShiftLeft'] || keys['ShiftRight']) ? SPEED * 2 : SPEED;
    px += (mx / mLen) * spd * dt;
    pz += (mz / mLen) * spd * dt;
  }

  // click-to-move
  if (walkTarget) {
    const dx = walkTarget[0] - px, dz = walkTarget[2] - pz;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > 0.3) {
      const s = Math.min(SPEED * dt, dist);
      px += (dx / dist) * s;
      pz += (dz / dist) * s;
      yaw = lerpAngle(yaw, Math.atan2(dx, dz), 0.08);
    } else {
      walkTarget = null;
    }
  }

  // camera
  const groundY = terrainHeight(px, pz);
  camera.position[0] = px;
  camera.position[1] = groundY + EYE_HEIGHT;
  camera.position[2] = pz;

  const lookX = Math.sin(yaw) * Math.cos(pitch);
  const lookY = Math.sin(pitch);
  const lookZ = Math.cos(yaw) * Math.cos(pitch);
  camera.target[0] = px + lookX;
  camera.target[1] = camera.position[1] + lookY;
  camera.target[2] = pz + lookZ;

  // world
  world.update(px, pz);

  if (world.dirty || !worldUploaded) {
    world.buildBuffers();
    renderer.uploadWorld(world);
    worldUploaded = true;
  }

  if (Math.abs(px - lastTerrainX) > 8 || Math.abs(pz - lastTerrainZ) > 8) {
    world.buildTerrain(px, pz);
    renderer.uploadTerrain(world);
    lastTerrainX = px; lastTerrainZ = pz;
  }

  if (Math.abs(px - lastGrassX) > 6 || Math.abs(pz - lastGrassZ) > 6) {
    world.buildGrass(px, pz);
    renderer.uploadGrass(world);
    lastGrassX = px; lastGrassZ = pz;
  }

  world.updateParticles(dt, px, pz);
  renderer.uploadParticles(world.particlePos);

  // extend stone path as needed
  if (pz + 80 > world._stoneMaxZ || pz - 80 < world._stoneMinZ) {
    world.generateStonePath(pz, 120);
    renderer.uploadWorld(world);
  }

  renderer.render(camera, world, time);
  requestAnimationFrame(frame);
}

// init
world.buildTerrain(0, 0);
renderer.uploadTerrain(world);
world.buildGrass(0, 0);
renderer.uploadGrass(world);
world.buildBuffers();
renderer.uploadWorld(world);
lastTerrainX = 0; lastTerrainZ = 0;
lastGrassX = 0; lastGrassZ = 0;

requestAnimationFrame(frame);
