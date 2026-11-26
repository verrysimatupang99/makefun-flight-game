// The ring course: glowing torus gates the pilot flies through in order.
// The next ring burns gold and pulses; passed rings turn green and dim;
// later rings wait in a cool blue so the course reads at a glance.
import { RINGS } from './config.js';
import { ringCentres } from './physics.js';

const NEXT_COLOR = 0xffb020;
const LATER_COLOR = 0x3fa7ff;
const PASSED_COLOR = 0x37c978;

/** Build the ring meshes and return { group, rings } where rings[i].mesh. */
export function buildRings(scene, THREE) {
  const centres = ringCentres();
  const group = new THREE.Group();
  const rings = centres.map((centre, index) => {
    const ringGroup = new THREE.Group();
    const torus = new THREE.Mesh(
      new THREE.TorusGeometry(RINGS.radius, 2.4, 12, 48),
      new THREE.MeshBasicMaterial({ color: index === 0 ? NEXT_COLOR : LATER_COLOR }),
    );
    ringGroup.add(torus);
    // Inner glow disc: faint, so the gate reads from far away.
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(RINGS.radius - 1, 40),
      new THREE.MeshBasicMaterial({
        color: index === 0 ? NEXT_COLOR : LATER_COLOR,
        transparent: true,
        opacity: 0.08,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    ringGroup.add(disc);
    // A small beacon light on top of the ring.
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(2.2, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    beacon.position.y = RINGS.radius + 3;
    ringGroup.add(beacon);
    // Face the ring along the course: toward the previous waypoint.
    const prev = centres[(index + centres.length - 1) % centres.length];
    ringGroup.position.set(centre.x, centre.y, centre.z);
    ringGroup.lookAt(prev.x, prev.y, prev.z);
    group.add(ringGroup);
    return { centre, mesh: ringGroup, torus, disc, beacon, passed: false };
  });
  scene.add(group);
  return { group, rings };
}

/** Recolour rings after a pass and pulse the next one. Called every frame. */
export function updateRings(rings, passedCount, time) {
  for (let i = 0; i < rings.length; i += 1) {
    const ring = rings[i];
    if (i < passedCount) {
      ring.torus.material.color.setHex(PASSED_COLOR);
      ring.disc.material.color.setHex(PASSED_COLOR);
      ring.disc.material.opacity = 0.04;
      ring.beacon.material.color.setHex(PASSED_COLOR);
      ring.passed = true;
    } else if (i === passedCount) {
      ring.torus.material.color.setHex(NEXT_COLOR);
      ring.disc.material.color.setHex(NEXT_COLOR);
      const pulse = 0.10 + 0.06 * Math.sin(time * 4);
      ring.disc.material.opacity = pulse;
      ring.torus.scale.setScalar(1 + 0.02 * Math.sin(time * 4));
      ring.beacon.material.color.setHex(0xffffff);
    } else {
      ring.torus.material.color.setHex(LATER_COLOR);
      ring.disc.material.color.setHex(LATER_COLOR);
      ring.disc.material.opacity = 0.05;
    }
  }
}
