// The flight model: an arcade plane that rewards throttle and turn discipline.
// Forward is +Z rotated by heading (heading 0 = north, +Z). Pitch positive
// climbs, roll positive banks right and turns the nose right.
import { PLANE, FUEL, RINGS, SCORE, WORLD } from './config.js';
import { terrainHeight, isWater, isRunway } from './terrain.js';

/** Fresh flight state: parked on the runway threshold, facing north. */
export function freshState() {
  return {
    x: 0,
    y: WORLD.runwayAltitude + 1.6,
    z: -WORLD.runwayHalfLength + 30,
    heading: 0,
    pitch: 0,
    roll: 0,
    speed: 0,
    throttle: 0,
    fuel: FUEL.start,
    score: 0,
    ringsPassed: 0,
    elapsed: 0,
    lastDt: 1 / 60,
    verticalSpeed: 0,
    status: 'parked', // parked | flying | crashed | landed | won
    crashReason: '',
    message: '',
    messageUntil: 0,
    outOfBounds: false,
    landedOnRunway: false,
    onGround: true, // true while rolling on (or parked on) the ground
  };
}

/** Ring centres in world space, computed once from the course spots. */
export function ringCentres() {
  return RINGS.spots.map(([x, above, z]) => ({
    x,
    y: terrainHeight(x, z) + above,
    z,
  }));
}

/**
 * Step the flight model by `dt` seconds.
 * `input` is { pitch: -1..1 (up positive), roll: -1..1 (right positive),
 * throttleDelta, brake, reset }. Returns an event string or ''.
 */
export function stepFlight(state, input, dt, rings) {
  state.lastDt = dt;
  if (state.status === 'crashed' || state.status === 'won') return '';

  // Throttle: W/S (or the input's delta) moves it, clamped 0..1.
  state.throttle = Math.min(1, Math.max(0, state.throttle + input.throttleDelta * dt * 0.9));

  // Speed chases the throttle's target; the airbrake halves it.
  let target = PLANE.minSpeed + state.throttle * (PLANE.maxSpeed - PLANE.minSpeed);
  if (input.brake) target *= PLANE.brakeFactor;
  const rate = target > state.speed ? PLANE.accel : PLANE.accel * 0.8;
  state.speed += Math.min(Math.abs(target - state.speed), rate * dt) * Math.sign(target - state.speed);

  // Attitude eases toward the stick, so the plane never snaps.
  const pitchTarget = input.pitch * PLANE.maxPitch;
  const rollTarget = input.roll * PLANE.maxRoll;
  state.pitch += (pitchTarget - state.pitch) * Math.min(1, dt * 3.2);
  state.roll += (rollTarget - state.roll) * Math.min(1, dt * 3.2);

  // Banking turns the nose; the turn is gentler at low speed. Positive roll
  // banks right, and a right bank turns the heading clockwise (toward east).
  const speedFactor = Math.min(1, state.speed / 45);
  state.heading += state.roll * PLANE.turnRate * speedFactor * dt;

  // Climb from pitch, minus the sink of a wing below stall speed. A plane
  // rolling on the ground does not sink: the stall sink only bites airborne.
  const groundBefore = terrainHeight(state.x, state.z);
  const sink = state.onGround ? 0 : Math.max(0, PLANE.stallSpeed - state.speed) * PLANE.stallSink;
  state.verticalSpeed = state.speed * Math.sin(state.pitch) - sink;
  const fx = Math.sin(state.heading);
  const fz = Math.cos(state.heading);
  state.x += fx * state.speed * Math.cos(state.pitch) * dt;
  state.z += fz * state.speed * Math.cos(state.pitch) * dt;
  state.y += state.verticalSpeed * dt;
  state.elapsed += dt;

  // Fuel: the clock that makes every sortie a decision.
  if (state.status === 'flying') {
    state.fuel -= (FUEL.drainPerSecond + FUEL.drainPerThrottle * state.throttle) * dt;
    if (state.fuel <= 0) {
      state.fuel = 0;
      state.throttle = 0;
      if (state.speed < PLANE.stallSpeed) {
        return crash(state, 'Fuel empty — she glided down and ran out of sky.');
      }
    }
  }

  // Out of the valley: warn, and gently push the nose home.
  state.outOfBounds = Math.abs(state.x) > WORLD.halfSize - 60 || Math.abs(state.z) > WORLD.halfSize - 60;
  if (state.outOfBounds) {
    state.message = 'Turn back — edge of the valley!';
    state.messageUntil = state.elapsed + 1;
  }

  // Ring check: the next ring only; fly within its radius to pass it.
  // Rings arrive as { centre: {x, y, z} } from buildRings.
  const next = rings[state.ringsPassed] && rings[state.ringsPassed].centre;
  if (next) {
    const dx = state.x - next.x;
    const dy = state.y - next.y;
    const dz = state.z - next.z;
    if (dx * dx + dy * dy + dz * dz < RINGS.radius * RINGS.radius) {
      state.ringsPassed += 1;
      state.score += SCORE.ring;
      state.fuel = Math.min(100, state.fuel + FUEL.ringBonus);
      state.message = `Ring ${state.ringsPassed} of ${RINGS.count}! +${SCORE.ring} pts, +fuel`;
      state.messageUntil = state.elapsed + 2.5;
      return 'ring';
    }
  }

  // Ground contact. A plane arriving from the air is judged (landing or
  // crash); one already rolling on the ground just taxis.
  const ground = terrainHeight(state.x, state.z);
  if (state.y > ground + 3) state.onGround = false;
  if (state.y <= ground + 1.6) {
    state.y = ground + 1.6;
    if (state.onGround) {
      state.verticalSpeed = 0;
      return '';
    }
    state.onGround = true;
    if (isWater(state.x, state.z)) {
      return crash(state, 'Ditched in the lake — the valley claims another.');
    }
    const gentle = Math.abs(state.verticalSpeed) < 7
      && state.speed < 52
      && Math.abs(state.roll) < 0.35
      && Math.abs(state.pitch) < 0.3;
    if (isRunway(state.x, state.z) && gentle) {
      return touchDown(state, rings);
    }
    if (state.speed < 8 && Math.abs(state.verticalSpeed) < 3) {
      // A slow, level belly landing on grass: survivable, but the run ends.
      return crash(state, 'Belly landing in the grass — walk away, fly again.');
    }
    return crash(state, 'Terrain strike — keep the nose up next time.');
  }
  return '';
}

/** A safe runway touchdown: refuel mid-course, or win after the last ring. */
function touchDown(state, rings) {
  state.speed *= 0.55;
  state.pitch = 0;
  state.roll = 0;
  if (state.ringsPassed >= RINGS.count) {
    state.status = 'won';
    const timeBonus = Math.max(0, Math.round((300 - state.elapsed) * SCORE.timeBonusRate));
    const fuelBonus = Math.round(state.fuel * SCORE.fuelBonusRate);
    state.score += SCORE.landing + timeBonus + fuelBonus;
    state.message = `Landed! +${SCORE.landing} landing, +${timeBonus} time, +${fuelBonus} fuel`;
    state.messageUntil = state.elapsed + 6;
    return 'won';
  }
  state.status = 'parked';
  state.landedOnRunway = true;
  state.fuel = Math.min(100, state.fuel + FUEL.runwayBonus);
  state.message = `Safe landing — refuelled +${FUEL.runwayBonus}. Throttle up to go again.`;
  state.messageUntil = state.elapsed + 4;
  return 'landed';
}

function crash(state, reason) {
  state.status = 'crashed';
  state.crashReason = reason;
  state.speed = 0;
  return 'crashed';
}

/** Reset the plane to the runway threshold, keeping the score and rings. */
export function resetToRunway(state) {
  const kept = { score: state.score, ringsPassed: state.ringsPassed, fuel: state.fuel, elapsed: state.elapsed };
  const fresh = freshState();
  Object.assign(state, fresh, kept);
  state.status = 'parked';
}

/** Heading in compass degrees (0 = north, 90 = east). */
export function headingDegrees(state) {
  const deg = ((state.heading * 180) / Math.PI) % 360;
  return deg < 0 ? deg + 360 : deg;
}

/** Compass point letter for a heading in degrees. */
export function compassPoint(deg) {
  const points = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return points[Math.round(deg / 45) % 8];
}
