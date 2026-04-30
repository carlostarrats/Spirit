import * as THREE from 'three';

// Follow camera: trails the character at a fixed offset. The character itself
// handles turning via the joystick, so the camera doesn't need to orbit —
// it just lerps toward a position behind the character.
//
// Right-drag / Ctrl+mouse still allows free look without rotating the
// character (purely visual), and the wheel zooms.
export class FollowCamera {
  constructor(camera, canvas, character) {
    this.camera = camera;
    this.canvas = canvas;
    this.character = character;
    this.distance = 14;
    this.minDist = 5;
    this.maxDist = 60;
    this.height = 4.5;          // camera Y above character feet
    this.lookAhead = 1.7;       // look-at point above character feet
    this.followSmooth = 0.12;   // lerp factor
    this.yawOffset = 0;         // user-tweaked offset (right-drag)
    this.pitchOffset = 0;

    this.dragging = false;
    this.lx = 0; this.ly = 0;

    canvas.addEventListener('mousedown', e => {
      if (e.button === 2) {
        this.dragging = true;
        this.lx = e.clientX; this.ly = e.clientY;
        e.preventDefault();
      }
    });
    addEventListener('mouseup', () => { this.dragging = false; });
    addEventListener('mousemove', e => {
      const ctrlLook = (e.ctrlKey || e.metaKey) && e.buttons === 0;
      if (this.dragging || ctrlLook) {
        this.yawOffset   -= (e.clientX - this.lx) * 0.005;
        this.pitchOffset += (e.clientY - this.ly) * 0.004;
        this.pitchOffset = THREE.MathUtils.clamp(this.pitchOffset, -0.4, 0.8);
      }
      this.lx = e.clientX; this.ly = e.clientY;
    });
    canvas.addEventListener('contextmenu', e => e.preventDefault());

    canvas.addEventListener('wheel', (e) => {
      this.distance *= Math.exp(e.deltaY * 0.001);
      this.distance = THREE.MathUtils.clamp(this.distance, this.minDist, this.maxDist);
      e.preventDefault();
    }, { passive: false });
  }

  update(dt) {
    const yaw = this.character.facing + Math.PI + this.yawOffset; // sit behind
    const pitch = 0.32 + this.pitchOffset;
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const lookAt = new THREE.Vector3(
      this.character.position.x,
      this.character.position.y + this.lookAhead,
      this.character.position.z,
    );
    const desired = new THREE.Vector3(
      lookAt.x + sy * cp * this.distance,
      lookAt.y + sp * this.distance + (this.height - this.lookAhead),
      lookAt.z + cy * cp * this.distance,
    );
    // exponential smoothing so the camera doesn't jitter on speed changes
    const k = 1 - Math.pow(1 - this.followSmooth, Math.max(1, dt * 60));
    this.camera.position.lerp(desired, k);
    this.camera.lookAt(lookAt);
  }
}
