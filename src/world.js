import { noise2d, fbm2d, initNoise, terrainHeight } from './noise.js';

export class World {
  constructor(seed = 42) {
    initNoise(seed);
    this.seed = seed;

    this.branchVerts = null;
    this.branchCount = 0;
    this.nodeVerts = null;
    this.nodeCount = 0;
    this.stoneVerts = null;
    this.stoneVertCount = 0;
    this._stoneMinZ = -100;
    this._stoneMaxZ = 100;

    this.terrainVerts = null;
    this.terrainIndices = null;
    this.terrainIdxCount = 0;

    this.grassVerts = null;
    this.grassVertCount = 0;

    this.maxParticles = 800;
    this.particlePos = new Float32Array(this.maxParticles * 4);
    this.particleVel = new Float32Array(this.maxParticles * 3);
    this.particleLife = new Float32Array(this.maxParticles);

    this.treeMeta = [];
    this.trees = [];
    this.generatedChunks = new Set();
    this.dirty = true;

    this.generateArea(0, 0, 80);
    this.buildBuffers();
    this.generateStonePath(0, 100);
    this.initParticles();
  }

  getPathX(z) {
    return fbm2d(z * 0.008, this.seed * 50, 3) * 18;
  }

  generateArea(cx, cz, radius) {
    const cs = 20;
    const minX = Math.floor((cx - radius) / cs);
    const maxX = Math.floor((cx + radius) / cs);
    const minZ = Math.floor((cz - radius) / cs);
    const maxZ = Math.floor((cz + radius) / cs);

    for (let xi = minX; xi <= maxX; xi++) {
      for (let zi = minZ; zi <= maxZ; zi++) {
        const key = `${xi},${zi}`;
        if (this.generatedChunks.has(key)) continue;
        this.generatedChunks.add(key);
        this.generateChunk(xi * cs, zi * cs, cs);
      }
    }
  }

  generateChunk(ox, oz, size) {
    const step = 3.0;
    for (let x = ox; x < ox + size; x += step) {
      for (let z = oz; z < oz + size; z += step) {
        const jx = noise2d(x * 0.3 + 100, z * 0.3) * 2.0;
        const jz = noise2d(x * 0.3, z * 0.3 + 100) * 2.0;
        const wx = x + jx, wz = z + jz;

        const d = noise2d(wx * 0.06, wz * 0.06);
        if (d < -0.05) continue;

        const pathX = this.getPathX(wz);
        if (Math.abs(wx - pathX) < 3.0) continue;

        const ty = terrainHeight(wx, wz);
        const sizeN = Math.abs(noise2d(wx * 0.03, wz * 0.03));
        const height = 5 + sizeN * 16;

        const treeSeed = Math.floor((wx * 73856093 + wz * 19349663) & 0xFFFFFF);
        this.trees.push(this.generateTree(wx, wz, ty, height, treeSeed));
        this.treeMeta.push({ x: wx, z: wz, y: ty, height });

        if (noise2d(wx * 0.5 + 777, wz * 0.5) > 0.1) {
          const fx = wx + noise2d(wx, wz) * 2;
          const fz = wz + noise2d(wz, wx) * 2;
          this.trees.push(this.generateFern(fx, fz, terrainHeight(fx, fz), treeSeed + 1));
        }
      }
    }
    this.dirty = true;
  }

  generateTree(bx, bz, by, height, seed) {
    const segs = [], nodes = [];
    let s = seed;
    function rng() { s = (s * 1664525 + 1013904223) & 0xFFFFFFFF; return (s >>> 0) / 4294967296; }

    const maxDepth = Math.min(7, 5 + Math.floor(height / 8));

    function grow(sx, sy, sz, dx, dy, dz, len, depth) {
      if (depth > maxDepth || len < 0.12) {
        nodes.push(sx, sy, sz, 0.4 + rng() * 0.6);
        return;
      }
      const ex = sx + dx * len, ey = sy + dy * len, ez = sz + dz * len;
      const bright = Math.max(0.15, 1.0 - depth * 0.11);
      segs.push(sx, sy, sz, bright, ex, ey, ez, bright);
      nodes.push(ex, ey, ez, 0.2 + rng() * 0.35);

      const n = depth < 1 ? 1 : depth < 3 ? 2 + Math.floor(rng() * 2) : 2;
      for (let i = 0; i < n; i++) {
        const sp = depth < 2 ? 0.35 : 0.5 + depth * 0.06;
        let ndx = dx + (rng() - 0.5) * sp * 2;
        let ndy = dy + rng() * 0.06 - 0.03;
        let ndz = dz + (rng() - 0.5) * sp * 2;
        if (depth < 3) ndy = Math.max(ndy, 0.25);
        const l = Math.sqrt(ndx * ndx + ndy * ndy + ndz * ndz) || 1;
        grow(ex, ey, ez, ndx / l, ndy / l, ndz / l, len * (0.55 + rng() * 0.2), depth + 1);
      }
    }

    let tx = bx, ty = by, tz = bz;
    let tdx = (rng() - 0.5) * 0.08, tdy = 1, tdz = (rng() - 0.5) * 0.08;
    let tl = Math.sqrt(tdx * tdx + tdy * tdy + tdz * tdz);
    tdx /= tl; tdy /= tl; tdz /= tl;
    const trunkLen = height * 0.35;

    for (let i = 0; i < 4; i++) {
      const sl = trunkLen / 4;
      const nx = tx + tdx * sl, ny = ty + tdy * sl, nz = tz + tdz * sl;
      segs.push(tx, ty, tz, 1.0, nx, ny, nz, 1.0);
      tx = nx; ty = ny; tz = nz;
      tdx += (rng() - 0.5) * 0.04; tdz += (rng() - 0.5) * 0.04;
      tl = Math.sqrt(tdx * tdx + tdy * tdy + tdz * tdz);
      tdx /= tl; tdy /= tl; tdz /= tl;
    }

    const cb = 3 + Math.floor(rng() * 3);
    for (let i = 0; i < cb; i++) {
      const a = (i / cb) * Math.PI * 2 + rng() * 0.6;
      const up = 0.35 + rng() * 0.45, out = Math.sqrt(1 - up * up);
      grow(tx, ty, tz, Math.cos(a) * out, up, Math.sin(a) * out, height * (0.18 + rng() * 0.15), 1);
    }

    const rc = 3 + Math.floor(rng() * 4);
    for (let i = 0; i < rc; i++) {
      const a = (i / rc) * Math.PI * 2 + rng() * 0.5;
      grow(bx, by, bz, Math.cos(a), -0.12 - rng() * 0.1, Math.sin(a), height * 0.1, maxDepth - 2);
    }

    return { segs, nodes };
  }

  generateFern(fx, fz, fy, seed) {
    const segs = [], nodes = [];
    let s = seed;
    function rng() { s = (s * 1664525 + 1013904223) & 0xFFFFFFFF; return (s >>> 0) / 4294967296; }

    const fronds = 3 + Math.floor(rng() * 3);
    const h = 0.3 + rng() * 0.5;
    for (let i = 0; i < fronds; i++) {
      const a = (i / fronds) * Math.PI * 2 + rng() * 0.5;
      const dx = Math.cos(a) * 0.4, dz = Math.sin(a) * 0.4;
      let cx = fx, cy = fy, cz = fz;
      for (let j = 0; j < 3; j++) {
        const nx = cx + dx * h * 0.4, ny = cy + (0.8 - j * 0.3) * h * 0.4, nz = cz + dz * h * 0.4;
        const b = 0.25 + (1 - j / 3) * 0.25;
        segs.push(cx, cy, cz, b, nx, ny, nz, b * 0.7);
        nodes.push(nx, ny, nz, b * 0.3);
        cx = nx; cy = ny; cz = nz;
      }
    }
    return { segs, nodes };
  }

  generateStonePath(centerZ, range) {
    const data = [];
    for (let z = centerZ - range; z < centerZ + range;) {
      const gap = 1.0 + Math.abs(noise2d(z * 0.5, 0)) * 0.8;
      z += gap;

      const pathX = this.getPathX(z);
      const sx = pathX + noise2d(z * 0.3, 100) * 0.4;
      const sz = z + noise2d(z * 0.3 + 50, 100) * 0.25;
      const sy = terrainHeight(sx, sz) + 0.015;

      let seed = Math.floor((sx * 73856 + sz * 19349) & 0xFFFF);
      function rng() { seed = (seed * 1664525 + 1013904223) & 0xFFFFFFFF; return (seed >>> 0) / 4294967296; }

      const sides = 5 + Math.floor(rng() * 3);
      const radius = 0.1 + rng() * 0.16;
      const pts = [];
      for (let i = 0; i < sides; i++) {
        const angle = (i / sides) * Math.PI * 2 + rng() * 0.3;
        const r = radius * (0.6 + rng() * 0.8);
        pts.push({ x: sx + Math.cos(angle) * r, y: sy + rng() * 0.015, z: sz + Math.sin(angle) * r });
      }
      for (let i = 0; i < sides; i++) {
        const p = pts[i], q = pts[(i + 1) % sides];
        const b = 0.35 + rng() * 0.3;
        data.push(p.x, p.y, p.z, b, q.x, q.y, q.z, b);
      }
    }
    this.stoneVerts = new Float32Array(data);
    this.stoneVertCount = data.length / 4;
    this._stoneMinZ = centerZ - range;
    this._stoneMaxZ = centerZ + range;
  }

  buildBuffers() {
    const allSegs = [], allNodes = [];
    for (const tree of this.trees) {
      for (let i = 0; i < tree.segs.length; i++) allSegs.push(tree.segs[i]);
      for (let i = 0; i < tree.nodes.length; i++) allNodes.push(tree.nodes[i]);
    }
    this.branchVerts = new Float32Array(allSegs);
    this.branchCount = allSegs.length / 4;
    this.nodeVerts = new Float32Array(allNodes);
    this.nodeCount = allNodes.length / 4;
    this.dirty = false;
  }

  buildTerrain(px, pz) {
    const size = 120, step = 2;
    const n = Math.floor(size / step) * 2 + 1;
    const bx = Math.floor(px / step) * step;
    const bz = Math.floor(pz / step) * step;
    const verts = [];
    for (let zi = 0; zi < n; zi++)
      for (let xi = 0; xi < n; xi++) {
        const wx = bx - size + xi * step, wz = bz - size + zi * step;
        verts.push(wx, terrainHeight(wx, wz), wz);
      }
    const indices = [];
    for (let z = 0; z < n - 1; z++)
      for (let x = 0; x < n - 1; x++) {
        const i = z * n + x;
        indices.push(i, i + 1, i + n, i + 1, i + n + 1, i + n);
      }
    this.terrainVerts = new Float32Array(verts);
    this.terrainIndices = new Uint32Array(indices);
    this.terrainIdxCount = indices.length;
  }

  buildGrass(px, pz) {
    const data = [];
    const range = 55, spacing = 0.55;

    for (let x = px - range; x < px + range; x += spacing) {
      for (let z = pz - range; z < pz + range; z += spacing) {
        const jx = noise2d(x * 2.3 + 500, z * 2.3 + 500) * spacing * 0.4;
        const jz = noise2d(x * 2.3 + 600, z * 2.3 + 600) * spacing * 0.4;
        const gx = x + jx, gz = z + jz;

        const ddx = gx - px, ddz = gz - pz;
        if (ddx * ddx + ddz * ddz > range * range) continue;

        const pathX = this.getPathX(gz);
        if (Math.abs(gx - pathX) < 1.3) continue;

        const gy = terrainHeight(gx, gz);
        const h = 0.35 + Math.abs(noise2d(gx * 0.15, gz * 0.15)) * 0.55;
        const phase = noise2d(gx * 0.7, gz * 0.7) * Math.PI * 2;

        // base vertex then tip vertex
        data.push(gx, gy, gz, h, phase, 0);
        data.push(gx, gy, gz, h, phase, 1);
      }
    }
    this.grassVerts = new Float32Array(data);
    this.grassVertCount = data.length / 6;
  }

  initParticles() {
    for (let i = 0; i < this.maxParticles; i++) this.spawnParticle(i);
  }

  spawnParticle(i) {
    if (!this.treeMeta.length) return;
    const tree = this.treeMeta[Math.floor(Math.random() * this.treeMeta.length)];
    const angle = Math.random() * Math.PI * 2, r = Math.random() * 1.5;
    const idx = i * 4, vi = i * 3;
    this.particlePos[idx] = tree.x + Math.cos(angle) * r;
    this.particlePos[idx + 1] = tree.y + Math.random() * tree.height * 0.8;
    this.particlePos[idx + 2] = tree.z + Math.sin(angle) * r;
    this.particlePos[idx + 3] = 0.3 + Math.random() * 0.7;
    this.particleVel[vi] = (Math.random() - 0.5) * 0.2;
    this.particleVel[vi + 1] = 0.3 + Math.random() * 0.8;
    this.particleVel[vi + 2] = (Math.random() - 0.5) * 0.2;
    this.particleLife[i] = 2 + Math.random() * 5;
  }

  updateParticles(dt, cx, cz) {
    for (let i = 0; i < this.maxParticles; i++) {
      this.particleLife[i] -= dt;
      if (this.particleLife[i] <= 0) { this.spawnParticle(i); continue; }
      const idx = i * 4, vi = i * 3;
      this.particleVel[vi] += (Math.random() - 0.5) * dt * 0.5;
      this.particleVel[vi + 2] += (Math.random() - 0.5) * dt * 0.5;
      this.particlePos[idx] += this.particleVel[vi] * dt;
      this.particlePos[idx + 1] += this.particleVel[vi + 1] * dt;
      this.particlePos[idx + 2] += this.particleVel[vi + 2] * dt;
      const lr = this.particleLife[i] / 5.0;
      this.particlePos[idx + 3] = Math.min(1.0, lr * 2.0) * (0.3 + Math.random() * 0.2);
      const dx = this.particlePos[idx] - cx, dz = this.particlePos[idx + 2] - cz;
      if (dx * dx + dz * dz > 65 * 65) this.spawnParticle(i);
    }
  }

  update(px, pz) {
    this.generateArea(px, pz, 70);
  }
}
