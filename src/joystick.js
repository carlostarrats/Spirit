// Virtual on-screen joystick. A small base circle sits in the bottom-left;
// dragging the thumb (mouse or touch) emits normalized (forward, turn) values
// in the range -1..1.
//
//   forward = -y axis (up = +1, down = -1)
//   turn    =  x axis (right = +1, left = -1)
//
// Snaps back to center on release.
export class JoyStick {
  constructor({ onMove, side = 'left', size = 130 } = {}) {
    this.onMove = onMove ?? (() => {});
    this.size = size;
    this.radius = size / 2;
    this.thumbRadius = size * 0.32;
    this.dragging = false;
    this.pointerId = null;
    this.cx = 0; this.cy = 0;          // current thumb offset from center, px

    // DOM
    this.base = document.createElement('div');
    Object.assign(this.base.style, {
      position: 'fixed',
      bottom: '32px',
      [side]: '32px',
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: '50%',
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,244,220,0.25)',
      touchAction: 'none',
      userSelect: 'none',
      zIndex: 100,
      backdropFilter: 'blur(2px)',
    });
    this.thumb = document.createElement('div');
    Object.assign(this.thumb.style, {
      position: 'absolute',
      left: `${size / 2 - this.thumbRadius}px`,
      top:  `${size / 2 - this.thumbRadius}px`,
      width:  `${this.thumbRadius * 2}px`,
      height: `${this.thumbRadius * 2}px`,
      borderRadius: '50%',
      background: 'rgba(255,244,220,0.18)',
      border: '1px solid rgba(255,244,220,0.55)',
      pointerEvents: 'none',
      transition: 'transform 0.1s ease-out',
    });
    this.base.appendChild(this.thumb);
    document.body.appendChild(this.base);

    this.base.addEventListener('pointerdown', (e) => this.onDown(e));
    addEventListener('pointermove', (e) => this.onMoveEvent(e));
    addEventListener('pointerup',   (e) => this.onUp(e));
    addEventListener('pointercancel', (e) => this.onUp(e));
  }

  onDown(e) {
    this.dragging = true;
    this.pointerId = e.pointerId;
    this.base.setPointerCapture?.(e.pointerId);
    this.update(e);
    this.thumb.style.transition = 'none';
    e.preventDefault();
  }

  onMoveEvent(e) {
    if (!this.dragging || e.pointerId !== this.pointerId) return;
    this.update(e);
  }

  onUp(e) {
    if (!this.dragging || e.pointerId !== this.pointerId) return;
    this.dragging = false;
    this.cx = 0; this.cy = 0;
    this.thumb.style.transition = 'transform 0.12s ease-out';
    this.thumb.style.transform = `translate(0px, 0px)`;
    this.onMove(0, 0);
  }

  update(e) {
    const rect = this.base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top  + rect.height / 2;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const len = Math.hypot(dx, dy);
    const max = this.radius - this.thumbRadius;
    if (len > max) {
      dx = (dx / len) * max;
      dy = (dy / len) * max;
    }
    this.cx = dx; this.cy = dy;
    this.thumb.style.transform = `translate(${dx}px, ${dy}px)`;
    const forward = -this.cy / max;   // up = forward
    const turn    =  this.cx / max;   // right = right turn
    this.onMove(forward, turn);
  }
}
