import * as THREE from 'three';
import { Copc } from 'copc';

// Loads a Cloud-Optimized Point Cloud (COPC) over HTTP using range requests.
// Strategy for phase 1b: walk the octree hierarchy from the root and load all
// nodes up to `maxDepth`. Each node becomes a THREE.Points object so the
// renderer can frustum-cull at the node level.
//
// The COPC file's coordinates are typically georeferenced (UTM / web mercator /
// state plane) — meters, but with a huge offset like (-8242596, 4966606, 0).
// We translate points to a local origin so floating-point precision is sane
// and the camera math stays in single-precision territory.
//
// Returns:
//   group: THREE.Group containing one Points child per loaded node
//   center: THREE.Vector3 with the world-space center we subtracted (for camera placement)
//   bounds: THREE.Box3 in local coords
//   stats: { nodeCount, pointCount }
export async function loadCopc(url, {
  maxDepth = 4,
  pointMaterial,
  group = null,
  concurrency = 6,
  onProgress = () => {},
} = {}) {
  const copc = await Copc.create(url);
  onProgress({ stage: 'header', copc });

  const { nodes } = await Copc.loadHierarchyPage(url, copc.info.rootHierarchyPage);
  const allKeys = Object.keys(nodes);
  const wantedKeys = allKeys.filter((k) => Number(k.split('-')[0]) <= maxDepth);
  onProgress({ stage: 'hierarchy', total: wantedKeys.length, allKeys: allKeys.length });

  // Pick a stable local origin. Use the cube center from COPC info — that's the
  // octree root cube and gives us a centered model.
  const [cx0, cy0, cz0, cx1, cy1, cz1] = copc.info.cube;
  const center = new THREE.Vector3(
    (cx0 + cx1) / 2,
    (cy0 + cy1) / 2,
    (cz0 + cz1) / 2,
  );

  const outGroup = group ?? new THREE.Group();
  const bounds = new THREE.Box3();
  bounds.makeEmpty();
  let pointCount = 0;
  let nodeCount = 0;

  // Bounded-concurrency loader. Workers pull keys off a shared cursor.
  // Each loaded node is added to the scene immediately so rendering starts
  // as soon as the first nodes arrive.
  let cursor = 0;
  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= wantedKeys.length) return;
      const key = wantedKeys[i];
      const node = nodes[key];
      if (!node) continue;
      try {
        const view = await Copc.loadPointDataView(url, copc, node);
        const n = view.pointCount;
      const getX = view.getter('X');
      const getY = view.getter('Y');
      const getZ = view.getter('Z');
      const getI = view.dimensions.Intensity ? view.getter('Intensity') : null;
      // Optional RGB (formats 2/3/7/8). Not all clouds have it.
      const getR = view.dimensions.Red ? view.getter('Red') : null;
      const getG = view.dimensions.Green ? view.getter('Green') : null;
      const getB = view.dimensions.Blue ? view.getter('Blue') : null;

      const positions = new Float32Array(n * 3);
      const intensities = new Float32Array(n);
      const colors = (getR && getG && getB) ? new Float32Array(n * 3) : null;

      for (let i = 0; i < n; i++) {
        // Z is up in LIDAR coords; we keep it as Y-up by swapping
        const x = getX(i) - center.x;
        const y = getY(i) - center.y;
        const z = getZ(i) - center.z;
        // Convert Z-up (LIDAR) to Y-up (three.js): three.js camera expects Y up
        positions[i * 3 + 0] = x;
        positions[i * 3 + 1] = z;
        positions[i * 3 + 2] = -y;

        // Intensity ranges vary across LIDAR datasets. We don't actually want
        // intensity-driven brightness for the ghost look — uniform per-point
        // intensity reads more contemplative. Slight modulation in [0.7, 1.0]
        // adds just enough texture to hint at material differences.
        const raw = getI ? getI(i) : 8000;
        intensities[i] = Math.max(0.7, Math.min(1.0, 0.7 + raw / 30000));

        if (colors) {
          // RGB stored as 16-bit per channel
          colors[i * 3 + 0] = getR(i) / 65535;
          colors[i * 3 + 1] = getG(i) / 65535;
          colors[i * 3 + 2] = getB(i) / 65535;
        }
      }

      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geom.setAttribute('aIntensity', new THREE.Float32BufferAttribute(intensities, 1));
      if (colors) geom.setAttribute('aColor', new THREE.Float32BufferAttribute(colors, 3));
      geom.computeBoundingBox();
      geom.computeBoundingSphere();
      if (geom.boundingBox) bounds.union(geom.boundingBox);

        const points = new THREE.Points(geom, pointMaterial);
        points.userData.copcKey = key;
        points.userData.depth = Number(key.split('-')[0]);
        outGroup.add(points);
        pointCount += n;
        nodeCount++;
        onProgress({ stage: 'loading', loaded: nodeCount, total: wantedKeys.length, pointCount });
      } catch (err) {
        console.warn(`COPC node ${key} load failed:`, err.message);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  onProgress({ stage: 'done', nodeCount, pointCount });
  return { group: outGroup, center, bounds, stats: { nodeCount, pointCount, totalNodes: allKeys.length } };
}
