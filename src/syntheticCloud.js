import * as THREE from 'three';

// Builds a synthetic point cloud meant to validate the renderer/aesthetic
// before we wire up real LIDAR. The distribution mimics a forest:
//   - a sparse ground plane of low-intensity points
//   - clusters of dense vertical points (trees) at random ground positions
//   - a few horizontal smears (downed logs / ground cover)
// This is throwaway — replaced in phase 1b by potree-core.
export function buildSyntheticForest({
  area = 80,
  groundDensity = 4,        // points per m²
  treeCount = 90,
  pointsPerTree = 4000,
} = {}) {
  const positions = [];
  const intensities = [];

  // ground
  const groundCount = Math.floor(area * area * groundDensity);
  for (let i = 0; i < groundCount; i++) {
    const x = (Math.random() - 0.5) * area;
    const z = (Math.random() - 0.5) * area;
    const y = (Math.random() - 0.5) * 0.15; // slight surface noise
    positions.push(x, y, z);
    intensities.push(0.25 + Math.random() * 0.15);
  }

  // trees
  for (let t = 0; t < treeCount; t++) {
    const cx = (Math.random() - 0.5) * area * 0.95;
    const cz = (Math.random() - 0.5) * area * 0.95;
    const height = 6 + Math.random() * 12;
    const trunkRadius = 0.18 + Math.random() * 0.12;
    const crownRadius = 1.5 + Math.random() * 2.0;
    const crownStart = height * 0.35;

    for (let i = 0; i < pointsPerTree; i++) {
      const r = Math.random();
      let x, y, z, intensity;
      if (r < 0.15) {
        // trunk
        const ang = Math.random() * Math.PI * 2;
        const rad = trunkRadius * (0.7 + Math.random() * 0.4);
        x = cx + Math.cos(ang) * rad;
        z = cz + Math.sin(ang) * rad;
        y = Math.random() * height;
        intensity = 0.35 + Math.random() * 0.2;
      } else {
        // crown — points distributed in an irregular ellipsoid above crownStart
        const ang = Math.random() * Math.PI * 2;
        const u = Math.random();
        const v = Math.random();
        const rad = crownRadius * Math.pow(u, 0.5) * (0.6 + Math.random() * 0.6);
        x = cx + Math.cos(ang) * rad;
        z = cz + Math.sin(ang) * rad;
        const heightInCrown = (height - crownStart) * v;
        y = crownStart + heightInCrown;
        // sparser at top
        if (Math.random() < heightInCrown / (height - crownStart) * 0.4) continue;
        intensity = 0.5 + Math.random() * 0.5;
      }
      positions.push(x, y, z);
      intensities.push(intensity);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('aIntensity', new THREE.Float32BufferAttribute(intensities, 1));
  geom.computeBoundingSphere();
  return { geometry: geom, count: positions.length / 3 };
}
