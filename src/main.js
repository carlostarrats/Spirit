import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import ghostVert from './shaders/ghostPoint.vert?raw';
import ghostFrag from './shaders/ghostPoint.frag?raw';
import { buildSyntheticForest } from './syntheticCloud.js';
import { loadCopc } from './copcCloud.js';
import { FollowCamera } from './controls.js';
import { loadFireFighter, CharacterController } from './character.js';
import { JoyStick } from './joystick.js';

const canvas = document.getElementById('canvas');
const statsEl = document.getElementById('stats');

const params = new URLSearchParams(location.search);
let cloudUrl = params.get('cloud');
if (cloudUrl === 'autzen') cloudUrl = 'https://hobu-lidar.s3.amazonaws.com/autzen-classified.copc.laz';
const useReal = !!cloudUrl;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight, false);
renderer.setClearColor(0x000000, 1);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 5000);

function makeMaterial({ withRGB = false } = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: ghostVert,
    fragmentShader: ghostFrag,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    defines: withRGB ? { USE_RGB: '' } : {},
    uniforms: {
      uPointSize: { value: 0.35 },
      uPixelRatio: { value: renderer.getPixelRatio() },
      uSizeScale: { value: 180.0 },
      uMinSize: { value: 1.0 },
      uMaxSize: { value: 2.0 },
      uOpacity: { value: 0.22 },
      uColor: { value: new THREE.Color(0xe8e2d3) },
      uFogNear: { value: 12 },
      uFogFar: { value: 75 },
      uColorMix: { value: 0.0 },
    },
  });
}

let activeMaterial = null;
let pointCount = 0;
let groundY = 0;
let cloudReady = false;
let character = null;   // populated async — until then, controls/camera fall back to identity

if (!useReal) {
  const { geometry, count } = buildSyntheticForest({
    area: 80,
    groundDensity: 18,
    treeCount: 180,
    pointsPerTree: 12000,
  });
  pointCount = count;
  activeMaterial = makeMaterial({ withRGB: false });
  scene.add(new THREE.Points(geometry, activeMaterial));
  cloudReady = true;
} else {
  statsEl.textContent = `loading ${cloudUrl}...`;
  activeMaterial = makeMaterial({ withRGB: true });
  activeMaterial.uniforms.uPointSize.value = 0.7;
  activeMaterial.uniforms.uSizeScale.value = 500.0;
  activeMaterial.uniforms.uMinSize.value = 1.0;
  activeMaterial.uniforms.uMaxSize.value = 2.2;
  activeMaterial.uniforms.uOpacity.value = 0.08;
  activeMaterial.uniforms.uFogNear.value = 1e6;
  activeMaterial.uniforms.uFogFar.value = 1e7;
  activeMaterial.uniforms.uColorMix.value = 0.0;

  const liveGroup = new THREE.Group();
  scene.add(liveGroup);
  let firstNodeFramed = false;

  loadCopc(cloudUrl, {
    maxDepth: 4,
    concurrency: 8,
    pointMaterial: activeMaterial,
    group: liveGroup,
    onProgress: (p) => {
      if (p.stage === 'header') {
        statsEl.textContent = `header parsed · ${p.copc.header.pointCount.toLocaleString()} total pts`;
      } else if (p.stage === 'hierarchy') {
        statsEl.textContent = `hierarchy: ${p.total} nodes ≤ depth (${p.allKeys} total)`;
      } else if (p.stage === 'loading') {
        statsEl.textContent = `loading ${p.loaded}/${p.total} · ${p.pointCount.toLocaleString()} pts`;
        if (!firstNodeFramed && liveGroup.children.length >= 4) {
          firstNodeFramed = true;
          const tmpBounds = new THREE.Box3().setFromObject(liveGroup);
          if (!tmpBounds.isEmpty()) {
            applyBoundsTuning(tmpBounds);
            cloudReady = true;
          }
        }
      }
    },
  }).then(({ bounds, stats }) => {
    pointCount = stats.pointCount;
    statsEl.textContent = `loaded ${stats.nodeCount}/${stats.totalNodes} nodes · ${stats.pointCount.toLocaleString()} pts`;
    applyBoundsTuning(bounds);
    cloudReady = true;
  }).catch((err) => {
    console.error('COPC load failed:', err);
    statsEl.textContent = `load error: ${err.message}`;
  });
}

function applyBoundsTuning(bounds) {
  const size = bounds.getSize(new THREE.Vector3());
  const r = Math.max(size.x, size.y, size.z);
  camera.far = Math.max(camera.far, r * 8);
  camera.updateProjectionMatrix();

  activeMaterial.uniforms.uFogNear.value = 0;
  activeMaterial.uniforms.uFogFar.value  = 120;

  groundY = bounds.min.y;
  const c = bounds.getCenter(new THREE.Vector3());
  if (character) character.position.set(c.x, groundY, c.z);
  pendingSpawn = { x: c.x, y: groundY, z: c.z };
}

let pendingSpawn = null;

// FireFighter character — loaded async, uses its own brighter material
const characterMaterial = makeMaterial({ withRGB: false });
characterMaterial.uniforms.uPointSize.value = 0.6;
characterMaterial.uniforms.uSizeScale.value = 80;
characterMaterial.uniforms.uMinSize.value = 1.2;
characterMaterial.uniforms.uMaxSize.value = 3.0;
characterMaterial.uniforms.uOpacity.value = 0.85;
characterMaterial.uniforms.uColor.value = new THREE.Color(0xfff4dc);
characterMaterial.uniforms.uFogNear.value = 1e6;
characterMaterial.uniforms.uFogFar.value = 1e7;

let followCam = null;

loadFireFighter(characterMaterial).then((build) => {
  scene.add(build.root);
  character = new CharacterController(build, { walkSpeed: 4, runSpeed: 9, turnSpeed: 2.0 });
  if (pendingSpawn) character.position.set(pendingSpawn.x, pendingSpawn.y, pendingSpawn.z);
  followCam = new FollowCamera(camera, canvas, character);
}).catch(err => {
  console.error('FireFighter load failed:', err);
  statsEl.textContent = `character load error: ${err.message}`;
});

// post-processing
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.18, 1.1, 0.85);
if (!useReal) {
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
}

// joystick — only control
const joystick = new JoyStick({
  side: 'left',
  size: 140,
  onMove: (forward, turn) => {
    if (character) character.setInput(forward, turn);
  },
});

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  if (activeMaterial) activeMaterial.uniforms.uPixelRatio.value = renderer.getPixelRatio();
}
addEventListener('resize', resize);

let last = performance.now();
let frame = 0;
function tick() {
  const now = performance.now();
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  let moveInfo = null;
  if (character) {
    moveInfo = character.update(dt);
    if (followCam) followCam.update(dt);
  }

  if (useReal) {
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);
  } else {
    composer.render();
  }

  if ((frame++ % 60) === 0 && pointCount > 0 && character) {
    const tag = useReal ? 'COPC' : 'synth';
    const status = moveInfo?.running ? 'running' : (moveInfo?.speed > 0.1 ? 'walking' : 'idle');
    statsEl.textContent = `${tag} · ${pointCount.toLocaleString()} pts · ${status} · char ${character.position.x.toFixed(1)}, ${character.position.z.toFixed(1)}`;
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

window.__spirit = { scene, camera, renderer, get character() { return character; }, get followCam() { return followCam; }, joystick, composer, get material() { return activeMaterial; } };
