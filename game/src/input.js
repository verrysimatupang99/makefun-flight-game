// Keyboard and mouse input: one small state object the flight model reads.
// Arrow keys pitch and roll, W/S throttle, Space airbrake, R reset, P pause,
// M mute, F free-fly. Mouse drag trims the chase camera a little.
export function createInput() {
  const keys = new Set();
  const input = {
    keys,
    cameraTrim: 0, // radians of extra yaw from mouse drag
    mouseDown: false,
    lastMouseX: 0,
    onKey: null, // set by main.js: called with (code) on keydown
    onPause: null,
    onReset: null,
    onMute: null,
    onFreeFly: null,
  };

  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'KeyP' && input.onPause) input.onPause();
    if (event.code === 'KeyR' && input.onReset) input.onReset();
    if (event.code === 'KeyM' && input.onMute) input.onMute();
    if (event.code === 'KeyF' && input.onFreeFly) input.onFreeFly();
    if (input.onKey) input.onKey(event.code);
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => keys.clear());

  const canvas = document.getElementById('scene');
  canvas.addEventListener('mousedown', (event) => {
    input.mouseDown = true;
    input.lastMouseX = event.clientX;
  });
  window.addEventListener('mouseup', () => { input.mouseDown = false; });
  window.addEventListener('mousemove', (event) => {
    if (!input.mouseDown) return;
    input.cameraTrim += (event.clientX - input.lastMouseX) * 0.003;
    input.cameraTrim = Math.max(-0.9, Math.min(0.9, input.cameraTrim));
    input.lastMouseX = event.clientX;
  });
  return input;
}

/** Read the held keys into the shape stepFlight wants, per frame. */
export function readFlightInput(input) {
  const keys = input.keys;
  let pitch = 0;
  let roll = 0;
  if (keys.has('ArrowUp')) pitch += 1;
  if (keys.has('ArrowDown')) pitch -= 1;
  if (keys.has('ArrowLeft')) roll -= 1;
  if (keys.has('ArrowRight')) roll += 1;
  // A/D mirror the arrows for the WASD crowd.
  if (keys.has('KeyA')) roll -= 1;
  if (keys.has('KeyD')) roll += 1;
  let throttleDelta = 0;
  if (keys.has('KeyW')) throttleDelta += 1;
  if (keys.has('KeyS')) throttleDelta -= 1;
  // Shift / Ctrl are a second throttle pair, for pilots who fly that way.
  if (keys.has('ShiftLeft') || keys.has('ShiftRight')) throttleDelta += 1;
  if (keys.has('ControlLeft') || keys.has('ControlRight')) throttleDelta -= 1;
  return {
    pitch: Math.max(-1, Math.min(1, pitch)),
    roll: Math.max(-1, Math.min(1, roll)),
    throttleDelta,
    brake: keys.has('Space'),
  };
}

/** True while the pilot holds any flying key. */
export function anyFlightKey(input) {
  for (const code of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyS', 'KeyA', 'KeyD']) {
    if (input.keys.has(code)) return true;
  }
  return false;
}
