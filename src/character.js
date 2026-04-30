import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

// Loads the Mixamo FireFighter FBX (skinned mesh) plus its named animations,
// then renders it as a pixel cloud. The skinned mesh itself is invisible; we
// CPU-skin its vertices to a separate THREE.Points each frame.
//
// Returns: { root, points, mixer, animations, controller }
//   root        — top-level Group placed at character feet, +Z forward
//   points      — THREE.Points rendered with the ghost shader
//   mixer       — THREE.AnimationMixer driving the FBX skeleton
//   animations  — { Idle, Walking, Running, ... } AnimationClip lookups
//   controller  — CharacterController instance
const ASSETS = 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/2666677/';
const ANIMS = ['Walking', 'Walking Backwards', 'Running'];

export async function loadFireFighter(material) {
  const loader = new FBXLoader();

  // 1) Base model (its first animation is "Idle")
  const obj = await loadAsync(loader, `${ASSETS}FireFighter.fbx`);
  obj.scale.setScalar(0.01);     // FBX is in centimeters
  obj.traverse(c => { if (c.isMesh) { c.castShadow = c.receiveShadow = false; c.visible = false; } });

  // The FireFighter rig has multiple SkinnedMesh children (jacket, head, etc.).
  // Find them all and concatenate their geometries into a single Points cloud.
  const skinnedMeshes = [];
  obj.traverse(c => { if (c.isSkinnedMesh) skinnedMeshes.push(c); });
  if (skinnedMeshes.length === 0) throw new Error('No SkinnedMesh found in FireFighter.fbx');

  // Build the rest-pose vertex list as a flat Float32Array. Each vertex
  // remembers (a) its source SkinnedMesh and (b) its index within that mesh,
  // so we can re-skin it each frame.
  const vertexSpec = [];   // [{ mesh, index }, ...]
  let totalVerts = 0;
  for (const sm of skinnedMeshes) {
    const n = sm.geometry.attributes.position.count;
    for (let i = 0; i < n; i++) vertexSpec.push({ mesh: sm, index: i });
    totalVerts += n;
  }

  // Optional thinning: a Mixamo character has ~5–10K verts; thinning makes
  // skinning cheaper without hurting the silhouette much.
  const stride = totalVerts > 4000 ? 2 : 1;
  const usedSpec = vertexSpec.filter((_, i) => i % stride === 0);
  const usedCount = usedSpec.length;

  const positions = new Float32Array(usedCount * 3);
  const intensities = new Float32Array(usedCount);
  for (let i = 0; i < usedCount; i++) intensities[i] = 0.85 + Math.random() * 0.15;

  const geom = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage);
  geom.setAttribute('position', posAttr);
  geom.setAttribute('aIntensity', new THREE.Float32BufferAttribute(intensities, 1));
  geom.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 2);  // skip computeBoundingSphere on dynamic geometry
  const points = new THREE.Points(geom, material);
  points.frustumCulled = false;

  // Mixer + Idle animation (the model's first clip)
  const mixer = new THREE.AnimationMixer(obj);
  const animations = {};
  animations.Idle = obj.animations[0];

  // 2) Load named animations
  for (const name of ANIMS) {
    const animObj = await loadAsync(loader, `${ASSETS}${encodeURIComponent(name)}.fbx`);
    if (animObj.animations[0]) animations[name] = animObj.animations[0];
  }

  // The FireFighter FBX has its forward axis aligned to -X in three.js after
  // FBXLoader's axis conversion (verified empirically by inspecting bone
  // positions: Thigh_L is at +Z, Thigh_R at -Z, so the L-to-R axis is -Z,
  // which means forward is -X). Our movement code expects forward = +Z
  // (sin(facing)*step in +Z when facing=0), so rotate the obj +π/2 around Y
  // to align: -X → +Z.
  const root = new THREE.Group();
  root.add(obj);
  obj.rotation.y = Math.PI / 2;
  obj.position.set(0, 0, 0);
  root.add(points);
  points.position.copy(obj.position);
  points.rotation.copy(obj.rotation);
  points.scale.copy(obj.scale);

  return { root, obj, points, mixer, animations, skinnedMeshes, usedSpec, posAttr };
}

function loadAsync(loader, url) {
  return new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject));
}

// Drives the FireFighter: animation state, motion, smoothed input.
export class CharacterController {
  constructor({ root, obj, mixer, animations, skinnedMeshes, usedSpec, posAttr },
              { walkSpeed = 4, runSpeed = 9, turnSpeed = 2.0 } = {}) {
    this.root = root;
    this.obj = obj;
    this.mixer = mixer;
    this.animations = animations;
    this.skinnedMeshes = skinnedMeshes;
    this.usedSpec = usedSpec;
    this.posAttr = posAttr;

    this.position = root.position;
    this.facing = 0;

    this.forwardInput = 0;
    this.turnInput = 0;
    this.forward = 0;
    this.turn = 0;
    this.inputSmooth = 6.0;

    this.walkSpeed = walkSpeed;
    this.runSpeed = runSpeed;
    this.turnSpeed = turnSpeed;
    this.runThreshold = 1.0;
    this.forwardTime = 0;

    this.currentAction = null;
    this.currentName = null;
    this.play('Idle');

    // Reusable scratch
    this._tmp = new THREE.Vector3();
  }

  setInput(forward, turn) {
    this.forwardInput = forward;
    this.turnInput = turn;
  }

  play(name) {
    if (this.currentName === name) return;
    const clip = this.animations[name];
    if (!clip) return;
    const next = this.mixer.clipAction(clip);
    next.reset().fadeIn(0.3).play();
    if (this.currentAction) this.currentAction.fadeOut(0.3);
    this.currentAction = next;
    this.currentName = name;
  }

  update(dt) {
    // Smooth inputs
    const k = 1 - Math.exp(-this.inputSmooth * dt);
    this.forward += (this.forwardInput - this.forward) * k;
    this.turn    += (this.turnInput    - this.turn)    * k;

    // Rotate
    this.facing += this.turn * this.turnSpeed * dt;
    this.root.rotation.y = this.facing;

    // Walk vs run
    const forwardHeld = this.forward > 0.5;
    if (forwardHeld) this.forwardTime += dt;
    else this.forwardTime = Math.max(0, this.forwardTime - dt * 2);
    const running = this.forwardTime > this.runThreshold;
    const baseSpeed = running ? this.runSpeed : this.walkSpeed;

    // Translate
    if (Math.abs(this.forward) > 0.02) {
      const step = baseSpeed * this.forward * dt;
      this.position.x += Math.sin(this.facing) * step;
      this.position.z += Math.cos(this.facing) * step;
    }

    // Decide animation state
    let nextAnim = 'Idle';
    if (this.forward > 0.3) {
      nextAnim = running ? 'Running' : 'Walking';
    } else if (this.forward < -0.3) {
      nextAnim = 'Walking Backwards';
    }
    this.play(nextAnim);

    // Advance animation
    this.mixer.update(dt);

    // Force the SkinnedMesh world matrices/skeleton to update so applyBoneTransform reads correct values
    for (const sm of this.skinnedMeshes) {
      sm.updateMatrixWorld(true);
      if (sm.skeleton) sm.skeleton.update();
    }

    // CPU-skin every vertex into the Points geometry.
    const arr = this.posAttr.array;
    const tmp = this._tmp;
    for (let i = 0; i < this.usedSpec.length; i++) {
      const { mesh, index } = this.usedSpec[i];
      tmp.fromBufferAttribute(mesh.geometry.attributes.position, index);
      mesh.applyBoneTransform(index, tmp);
      arr[i * 3 + 0] = tmp.x;
      arr[i * 3 + 1] = tmp.y;
      arr[i * 3 + 2] = tmp.z;
    }
    this.posAttr.needsUpdate = true;

    return { running, speed: Math.abs(this.forward) * baseSpeed };
  }
}
