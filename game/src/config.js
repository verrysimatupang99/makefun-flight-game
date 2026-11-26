// Shared tuning for Awan Valley Ring Run: world size, flight model, rings, fuel.
// Every number here is picked so a first-time pilot can finish the course in
// about three minutes at a comfortable throttle, with fuel as the real clock.
export const WORLD = {
  halfSize: 2000, // metres from centre to each edge of the terrain square
  waterLevel: 2, // terrain below this is the lake / sea
  runwayAltitude: 12, // flattened height of the runway strip
  runwayHalfLength: 260,
  runwayHalfWidth: 20,
};

export const PLANE = {
  maxSpeed: 92, // m/s at full throttle (about 179 knots)
  minSpeed: 12, // m/s at idle
  accel: 14, // m/s^2 toward the throttle's target speed
  brakeFactor: 0.5, // Space (airbrake) multiplies the target speed by this
  maxRoll: 0.95, // radians of bank at full stick
  maxPitch: 0.55, // radians of pitch at full stick
  stallSpeed: 30, // below this the wing stops flying and the plane sinks
  stallSink: 0.45, // extra sink per m/s under stall speed
  turnRate: 0.85, // heading radians per second at full bank
};

export const FUEL = {
  start: 100,
  drainPerSecond: 0.12, // base burn
  drainPerThrottle: 0.5, // extra burn at full throttle
  ringBonus: 12, // fuel topped up by each ring flown
  runwayBonus: 25, // fuel topped up by a safe runway touchdown mid-course
};

export const RINGS = {
  count: 8,
  radius: 28, // metres; passing means coming within this of the centre
  // Course waypoints across the valley: [x, height above terrain, z].
  // The course climbs from the runway, crosses the lake, threads the
  // mountain gap, then comes home for the landing.
  spots: [
    [0, 55, 620],
    [520, 85, 1080],
    [1120, 115, 880],
    [1420, 145, 180],
    [1180, 125, -620],
    [480, 95, -1120],
    [-360, 75, -1300],
    [-920, 85, -560],
  ],
};

export const SCORE = {
  ring: 100,
  landing: 500,
  timeBonusRate: 2, // points per second under the 300 s par, at landing
  fuelBonusRate: 3, // points per fuel unit left at landing
};

export const MESSAGES = {
  title: 'AWAN VALLEY RING RUN',
  subtitle: 'Fly the ring course, mind your fuel, bring her home.',
};
