// Keyboard + mouse state, in canvas coordinates. The game polls this every
// frame; menu keys are consumed once via pressed() so a single tap never
// fires twice.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressedQueue = [];
    this.mouse = { x: 0, y: 0, down: false };
    this.canvas = canvas;

    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }
      if (!e.repeat) {
        this.keys.add(e.code);
        this.pressedQueue.push(e.code);
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouse.down = false;
    });

    const toLocal = (e) => {
      const r = canvas.getBoundingClientRect();
      return {
        x: ((e.clientX - r.left) / r.width) * canvas.width,
        y: ((e.clientY - r.top) / r.height) * canvas.height,
      };
    };
    canvas.addEventListener('mousemove', (e) => {
      const p = toLocal(e);
      this.mouse.x = p.x; this.mouse.y = p.y;
    });
    canvas.addEventListener('mousedown', (e) => {
      const p = toLocal(e);
      this.mouse.x = p.x; this.mouse.y = p.y;
      this.mouse.down = true;
    });
    window.addEventListener('mouseup', () => { this.mouse.down = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  down(code) { return this.keys.has(code); }

  /** True once for the frame after the key went down. */
  pressed(code) {
    const i = this.pressedQueue.indexOf(code);
    if (i === -1) return false;
    this.pressedQueue.splice(i, 1);
    return true;
  }

  /** Movement vector from WASD / arrows, normalised. */
  moveVector() {
    let x = 0, y = 0;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    if (this.down('KeyW') || this.down('ArrowUp')) y -= 1;
    if (this.down('KeyS') || this.down('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
    return { x, y };
  }

  get firing() { return this.mouse.down || this.down('Space'); }

  endFrame() { this.pressedQueue.length = 0; }
}
