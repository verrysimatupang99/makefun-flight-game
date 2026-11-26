// Screenshot poses and the test autopilot.
// ?shot=cover|ring|landing poses the plane in a real flight state and freezes
// the simulation after one frame, so a headless screenshot is a stable render
// of the game's own code. ?autopilot=1 flies the course by itself (a play-test
// aid, invisible in normal play). ?selftest=1 runs the physics headlessly and
// writes the result into #selftest for automated checks.
import { RINGS, WORLD } from './config.js';
import { freshState, ringCentres, stepFlight } from './physics.js';
import { terrainHeight } from './terrain.js';

const SHOT_STEPS = 1 / 60;

/** Pose the flight state for a named screenshot, then freeze the sim. */
export function stageShot(name, state, rings) {
  const centres = ringCentres();
  if (name === 'ring') {
    // Mid-flight, closing on the first gold ring, valley and lake ahead.
    const ring = centres[0];
    state.x = ring.x - Math.sin(0.35) * 130;
    state.z = ring.z - Math.cos(0.35) * 130;
    state.y = ring.y + 6;
    state.heading = Math.atan2(ring.x - state.x, ring.z - state.z);
    state.pitch = 0.02;
    state.roll = -0.08;
    state.speed = 62;
    state.throttle = 0.78;
  } else if (name === 'landing') {
    // On final approach: low, slow, lined up on the runway centreline.
    state.x = 6;
    state.y = WORLD.runwayAltitude + 42;
    state.z = -WORLD.runwayHalfLength - 320;
    state.heading = 0;
    state.pitch = -0.06;
    state.roll = 0.02;
    state.speed = 44;
    state.throttle = 0.45;
  } else {
    // Cover: low pass over the runway, strip stretching ahead, ring 1 gold.
    state.x = -4;
    state.y = WORLD.runwayAltitude + 38;
    state.z = -WORLD.runwayHalfLength + 60;
    state.heading = 0.02;
    state.pitch = 0.03;
    state.roll = -0.05;
    state.speed = 58;
    state.throttle = 0.72;
  }
  state.status = 'flying';
  state.fuel = 78;
  state.score = name === 'ring' ? 0 : name === 'landing' ? RINGS.count * 100 : 200;
  state.ringsPassed = name === 'landing' ? RINGS.count : name === 'ring' ? 0 : 2;
  state.elapsed = name === 'landing' ? 186 : name === 'ring' ? 41 : 96;
  state.message = name === 'landing'
    ? 'All rings flown! Land on the runway to finish.'
    : name === 'ring'
      ? 'Fly through ring 1 of 8 — follow the gold gate.'
      : 'Ring 3 of 8 — keep the gold gate centred.';
  state.messageUntil = state.elapsed + 30;
  // One physics step so the pose is a state the game itself reached.
  stepFlight(state, { pitch: 0, roll: 0, throttleDelta: 0, brake: false }, SHOT_STEPS, rings);
  state.status = 'flying';
  return state;
}

/**
 * A simple autopilot for play-testing: steer toward the next ring (or the
 * runway once the course is done), hold altitude above the terrain, and keep
 * the throttle up. Returns the input shape stepFlight wants.
 */
export function autopilotInput(state, rings) {
  // Final approach once the course is done: first fly to the final approach
  // fix on the extended centreline, south of the runway, then descend along
  // the centreline to the threshold. (The same fix also catches a go-around:
  // a plane that blew past the runway simply flies back out to the fix.)
  if (state.ringsPassed >= RINGS.count) {
    // On the final leg when lined up on the centreline and between the fix
    // and the far end of the runway: this test must not flip back mid-approach
    // (a z-only test did exactly that and the plane ping-ponged between legs).
    const onFinalLeg = Math.abs(state.x) < 80 && state.z > -900 && state.z < 200;
    const fix = { x: 0, y: WORLD.runwayAltitude + 58, z: -750 };
    if (!onFinalLeg) {
      const wantedHeading = Math.atan2(fix.x - state.x, fix.z - state.z);
      let headingError = wantedHeading - state.heading;
      while (headingError > Math.PI) headingError -= Math.PI * 2;
      while (headingError < -Math.PI) headingError += Math.PI * 2;
      const roll = Math.max(-1, Math.min(1, headingError * 1.6));
      let pitch = 0;
      if (state.y > fix.y + 6) pitch = -0.4;
      else if (state.y < fix.y - 6) pitch = 0.4;
      return {
        pitch,
        roll,
        throttleDelta: state.speed > 48 ? -1 : state.speed < 38 ? 0.6 : 0,
        brake: false,
      };
    }
    const distToThreshold = Math.hypot(state.x, state.z + WORLD.runwayHalfLength);
    const slopeAlt = WORLD.runwayAltitude + 4 + Math.min(80, distToThreshold * 0.07);
    // South of the strip the valley floor rises above the runway: stay 24 m
    // clear of the local ground until over the flattened strip, then the
    // slope alone brings the plane down to the threshold.
    const ground = terrainHeight(state.x, state.z);
    const wantAlt = state.z < -WORLD.runwayHalfLength
      ? Math.max(slopeAlt, ground + 24)
      : slopeAlt;
    // Aim far down the runway, not at a near point the plane flies past:
    // a near aim point flips the bearing 180° the moment the plane passes
    // it, and the turn that follows happens at landing height.
    const wantedHeading = Math.atan2(0 - state.x, 1000 - state.z);
    let headingError = wantedHeading - state.heading;
    while (headingError > Math.PI) headingError -= Math.PI * 2;
    while (headingError < -Math.PI) headingError += Math.PI * 2;
    const roll = Math.max(-1, Math.min(1, headingError * 1.6));
    // Proportional pitch: track the glide slope instead of bang-bang diving,
    // so the descent rate at touchdown stays gentle.
    const pitch = Math.max(-0.5, Math.min(0.5, (wantAlt - state.y) * 0.05));
    // Approach speed discipline: hold about 42 m/s. Flare only once low over
    // (or just short of) the runway: flaring early kills the speed and the
    // plane sinks onto the rising ground south of the strip. Never brake in
    // the air: holding approach speed is enough, and a stalled wing drops hard.
    const nearStrip = state.z > -WORLD.runwayHalfLength - 40 && Math.abs(state.x) < 60;
    const flaring = state.y < WORLD.runwayAltitude + 12
      || (nearStrip && state.y < WORLD.runwayAltitude + 20);
    const throttleDelta = state.speed > 48 ? -1 : state.speed < 38 ? 0.6 : 0;
    return {
      pitch: flaring ? -0.12 : pitch,
      roll,
      throttleDelta,
      brake: false,
    };
  }
  const target = rings[state.ringsPassed].centre;
  const dx = target.x - state.x;
  const dz = target.z - state.z;
  const wantedHeading = Math.atan2(dx, dz);
  let headingError = wantedHeading - state.heading;
  while (headingError > Math.PI) headingError -= Math.PI * 2;
  while (headingError < -Math.PI) headingError += Math.PI * 2;
  const roll = Math.max(-1, Math.min(1, headingError * 1.6));
  const ground = terrainHeight(state.x, state.z);
  const clearance = state.y - ground;
  const wantAlt = Math.max(target.y, ground + 45);
  let pitch = 0;
  if (state.y < wantAlt - 12) pitch = 0.7;
  else if (state.y > wantAlt + 25) pitch = -0.5;
  else if (state.y < wantAlt - 3) pitch = 0.25;
  return {
    pitch,
    roll,
    throttleDelta: 1,
    brake: false,
  };
}

/**
 * Headless self-test: run the autopilot through the course in fixed steps
 * and return a plain report object (rings, fuel, final status, time).
 */
export function runSelfTest(rings) {
  const state = freshState();
  state.status = 'flying';
  state.throttle = 0.7;
  const events = [];
  const dt = 1 / 60;
  const maxSteps = 60 * 600;
  let steps = 0;
  while (steps < maxSteps) {
    steps += 1;
    const event = stepFlight(state, autopilotInput(state, rings), dt, rings);
    if (event) events.push(`${event}@${state.elapsed.toFixed(1)}s`);
    if (state.status === 'won' || state.status === 'crashed') break;
  }
  return {
    steps,
    status: state.status,
    ringsPassed: state.ringsPassed,
    score: state.score,
    fuel: Math.round(state.fuel),
    elapsed: Math.round(state.elapsed),
    crashReason: state.crashReason,
    events: events.slice(0, 20),
  };
}
