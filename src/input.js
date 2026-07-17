// Central input: keyboard, pointer-lock mouse look with drag fallback.
export const keys = {};
export const mouse = { dx: 0, dy: 0, down: false };
const keyHandlers = [];
const clickHandlers = [];

export function onKeyPress(cb) { keyHandlers.push(cb); }
export function onClick(cb) { clickHandlers.push(cb); }

export function consumeMouseDelta() {
  const d = { dx: mouse.dx, dy: mouse.dy };
  mouse.dx = 0; mouse.dy = 0;
  return d;
}

export function initInput(canvas) {
  addEventListener('keydown', e => {
    if (e.repeat) return;
    keys[e.code] = true;
    keyHandlers.forEach(cb => cb(e.code));
  });
  addEventListener('keyup', e => { keys[e.code] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

  let dragging = false, lx = 0, ly = 0;
  canvas.addEventListener('mousedown', e => {
    mouse.down = true;
    dragging = true; lx = e.clientX; ly = e.clientY;
    clickHandlers.forEach(cb => cb(e));
    if (document.pointerLockElement !== canvas) {
      canvas.requestPointerLock?.();
    }
  });
  addEventListener('mouseup', () => { mouse.down = false; dragging = false; });
  addEventListener('mousemove', e => {
    if (document.pointerLockElement === canvas) {
      mouse.dx += e.movementX; mouse.dy += e.movementY;
    } else if (dragging) {
      mouse.dx += e.clientX - lx; mouse.dy += e.clientY - ly;
      lx = e.clientX; ly = e.clientY;
    }
  });
}
export function releasePointer() { document.exitPointerLock?.(); }
