// Awan Valley Ring Run — bootstrap and game loop.
// Chase camera, state machine (title / flying / paused / crashed / won),
// screenshot poses, the test autopilot, and the self-test hook.
import { WORLD, RINGS } from './config.js';
import { buildWorld, terrainHeight } from './terrain.js';
import { buildAircraft, makeGroundShadow, poseAircraft } from './aircraft.js';
import { freshState, stepFlight, resetToRunway } from './physics.js';
import { buildRings, updateRings } from './rings.js';
import { createInput, readFlightInput } from './input.js';
import { createAudio } from './audio.js';
import { createHud, updateHud, showOverlay, showCrash, showWin, setTitleText } from './hud.js';
import { stageShot, autopilotInput, runSelfTest } from './shots.js';

const THREE = window.THREE;
const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const useAutopilot = params.get('autopilot') === '1';
const selfTest = params.get('selftest') === '1';

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8ec8ee);
scene.fog = new THREE.Fog(0xa8c8e8, 700, 3400);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.5, 6000);

buildWorld(scene, THREE);
const plane = buildAircraft(THREE);
scene.add(plane);
const groundShadow = makeGroundShadow(THREE);
scene.add(groundShadow);
const course = buildRings(scene, THREE);

const state = freshState();
const input = createInput();
const audio = createAudio();
const hud = createHud();
setTitleText();

let screen = 'title'; // title | flying | paused | crashed | won | shot
let freeFly = false;
let cameraYaw = 0;
const cameraPos = new THREE.Vector3(0, 60, -40);
const cameraTarget = new THREE.Vector3(0, 20, 0);

function startFlying(free) {
  audio.start();
  freeFly = free;
  if (state.status === 'crashed' || state.status === 'won') {
    const keptScore = state.status === 'won' ? 0 : state.score;
    const keptRings = state.status === 'won' ? 0 : state.ringsPassed;
    Object.assign(state, freshState(), { score: keptScore, ringsPassed: keptRings });
  }
  if (freeFly) {
    state.fuel = 100;
    state.ringsPassed = RINGS.count; // no gates in free fly
  }
  state.status = 'flying';
  screen = 'flying';
  showOverlay(hud, null);
}

function pauseGame() {
  if (screen !== 'flying') return;
  screen = 'paused';
  showOverlay(hud, 'pause');
}

function resumeGame() {
  if (screen !== 'paused') return;
  screen = 'flying';
  showOverlay(hud, null);
}

function resetPlane() {
  if (screen !== 'flying' && screen !== 'crashed') return;
  resetToRunway(state);
  if (screen === 'crashed') {
    screen = 'flying';
    showOverlay(hud, null);
  }
}

input.onPause = () => (screen === 'paused' ? resumeGame() : pauseGame());
input.onReset = resetPlane;
input.onMute = () => {
  const muted = audio.toggleMute();
  state.message = muted ? 'Sound off (M to turn back on)' : 'Sound on';
  state.messageUntil = state.elapsed + 2;
};
input.onFreeFly = () => {
  if (screen === 'title' || screen === 'flying') startFlying(!freeFly);
};
input.onKey = (code) => {
  audio.start();
  if (screen === 'title' && (code === 'Enter' || code === 'Space')) startFlying(false);
  if (screen === 'crashed' && code === 'Enter') { resetPlane(); }
  if (screen === 'won' && code === 'Enter') startFlying(false);
};

document.getElementById('btn-start').addEventListener('click', () => startFlying(false));
document.getElementById('btn-freefly').addEventListener('click', () => startFlying(true));
document.getElementById('btn-resume').addEventListener('click', resumeGame);
document.getElementById('btn-restart').addEventListener('click', () => { resetPlane(); });
document.getElementById('btn-flyagain').addEventListener('click', () => startFlying(false));
document.getElementById('btn-flyagain-win').addEventListener('click', () => startFlying(false));

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/** Chase camera: behind and above the plane, eased, never snapping. */
function chaseCameraPose() {
  const fx = Math.sin(state.heading);
  const fz = Math.cos(state.heading);
  const trim = input.cameraTrim;
  const backX = -fx * Math.cos(trim) - fz * Math.sin(trim);
  const backZ = -fz * Math.cos(trim) + fx * Math.sin(trim);
  const dist = 15 + state.speed * 0.06;
  return {
    pos: new THREE.Vector3(
      state.x + backX * dist,
      state.y + 4.5 + state.speed * 0.012,
      state.z + backZ * dist,
    ),
    target: new THREE.Vector3(state.x + fx * 22, state.y + 1.5, state.z + fz * 22),
  };
}

function updateCamera(dt) {
  const desired = chaseCameraPose();
  const k = 1 - Math.exp(-dt * 4.5);
  cameraPos.lerp(desired.pos, k);
  cameraTarget.lerp(desired.target, 1 - Math.exp(-dt * 7));
  camera.position.copy(cameraPos);
  camera.lookAt(cameraTarget);
}

/** Put the camera straight on the chase spot: screenshot poses need the
 * converged view on the very first frame, not after the ease-in. */
function snapCameraToChase() {
  const desired = chaseCameraPose();
  cameraPos.copy(desired.pos);
  cameraTarget.copy(desired.target);
  camera.position.copy(cameraPos);
  camera.lookAt(cameraTarget);
}

/** One frame: step the sim (unless paused / shot), update the world, draw. */
let lastTime = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
  lastTime = now;
  const time = now / 1000;

  if (screen === 'flying') {
    const flightInput = useAutopilot ? autopilotInput(state, course.rings) : readFlightInput(input);
    const event = stepFlight(state, flightInput, dt, course.rings);
    if (event === 'ring') audio.ringChime();
    if (event === 'crashed') {
      audio.crashThud();
      screen = 'crashed';
      showCrash(hud, state);
    }
    if (event === 'won') {
      audio.landingFanfare();
      screen = 'won';
      showWin(hud, state);
    }
    if (event === 'landed') audio.landingFanfare();
    if (freeFly) state.fuel = 100;
    audio.setEngine(state.throttle, state.speed, state.status === 'flying');
  }

  updateRings(course.rings, state.ringsPassed, time);
  poseAircraft(plane, groundShadow, state, terrainHeight(state.x, state.z));
  updateCamera(dt);
  updateHud(hud, state, freeFly);

  // Clouds drift slowly with the wind.
  const clouds = scene.getObjectByName('clouds');
  if (clouds) {
    clouds.position.x += dt * 2.5;
    if (clouds.position.x > 400) clouds.position.x = -400;
  }
  renderer.render(scene, camera);
}

// Screenshot poses: stage the plane, hide the overlays, freeze the sim.
if (shotName) {
  stageShot(shotName, state, course.rings);
  screen = 'shot';
  showOverlay(hud, null);
  state.message = state.message || '';
  snapCameraToChase();
} else if (selfTest) {
  // Headless verification: run the whole course now, publish the report.
  const report = runSelfTest(course.rings);
  const pre = document.getElementById('selftest');
  pre.textContent = JSON.stringify(report);
  document.title = `SELFTEST ${report.status} rings=${report.ringsPassed}`;
  screen = 'shot';
  showOverlay(hud, null);
} else if (useAutopilot) {
  // Play-test hook: skip the title screen and fly the course at once.
  startFlying(false);
} else {
  showOverlay(hud, 'title');
  // Title screen: the plane sits on the runway, camera slowly orbiting it.
  state.status = 'parked';
  state.throttle = 0;
  cameraPos.set(18, 22, -60);
}

requestAnimationFrame(frame);

// If WebGL never started, say so plainly instead of a black page.
window.addEventListener('error', (event) => {
  const el = document.getElementById('webgl-error');
  if (el && String(event.message).includes('WebGL')) el.classList.remove('hidden');
});
