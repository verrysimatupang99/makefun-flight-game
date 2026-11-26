// The aircraft: a built-looking low-poly prop plane in cream and red, with a
// spinning propeller, banked wings on turns, and a soft shadow blob so the
// ground below reads the plane's height.
export function buildAircraft(THREE) {
  const plane = new THREE.Group();
  const cream = new THREE.MeshLambertMaterial({ color: 0xf2e8d5 });
  const red = new THREE.MeshLambertMaterial({ color: 0xc23b2e });
  const dark = new THREE.MeshLambertMaterial({ color: 0x2b2f36 });
  const glass = new THREE.MeshLambertMaterial({ color: 0x274b63 });

  // Fuselage: a tapered cylinder along the forward axis (+Z is forward here,
  // matching the flight model's heading math).
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.55, 5.6, 10), cream);
  fuselage.rotation.x = Math.PI / 2;
  fuselage.position.z = 0.2;
  plane.add(fuselage);
  // Nose cone and spinner.
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.4, 10), red);
  nose.rotation.x = Math.PI / 2;
  nose.position.z = 3.7;
  plane.add(nose);
  // Tail cone.
  const tailCone = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.6, 10), cream);
  tailCone.rotation.x = -Math.PI / 2;
  tailCone.position.z = -3.4;
  plane.add(tailCone);

  // Main wing: a wide flat box with red tips, slightly swept by rotation.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(11.4, 0.28, 2.1), cream);
  wing.position.set(0, 0.1, 0.6);
  plane.add(wing);
  for (const side of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.3, 2.1), red);
    tip.position.set(side * 5.1, 0.1, 0.6);
    plane.add(tip);
    // Wing struts down to the fuselage.
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.6, 6), dark);
    strut.position.set(side * 1.8, -0.7, 0.6);
    strut.rotation.z = side * 0.5;
    plane.add(strut);
  }

  // Tailplane and fin.
  const tailplane = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.22, 1.4), cream);
  tailplane.position.set(0, 0.25, -3.6);
  plane.add(tailplane);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.9, 1.6), red);
  fin.position.set(0, 1.0, -3.7);
  fin.rotation.x = -0.25;
  plane.add(fin);

  // Canopy: a dark glass bubble over the cockpit.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.75, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), glass);
  canopy.scale.set(1, 0.75, 1.9);
  canopy.position.set(0, 0.55, 0.9);
  plane.add(canopy);

  // Fixed landing gear: two small wheels, so a runway landing reads.
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.1, 6), dark);
    leg.position.set(side * 1.1, -0.9, 1.2);
    plane.add(leg);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10), dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(side * 1.1, -1.45, 1.2);
    plane.add(wheel);
  }

  // Propeller: hub plus two blades, spun by the flight loop.
  const prop = new THREE.Group();
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.5, 8), dark);
  hub.rotation.x = Math.PI / 2;
  prop.add(hub);
  const bladeGeo = new THREE.BoxGeometry(0.34, 3.6, 0.12);
  const bladeMat = new THREE.MeshLambertMaterial({ color: 0x1f2226 });
  const blade1 = new THREE.Mesh(bladeGeo, bladeMat);
  const blade2 = new THREE.Mesh(bladeGeo, bladeMat);
  blade2.rotation.z = Math.PI / 2;
  prop.add(blade1);
  prop.add(blade2);
  // Red tips on the blades.
  for (const [x, y] of [[0, 1.65], [0, -1.65], [1.65, 0], [-1.65, 0]]) {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.35, 0.14), red);
    tip.position.set(x, y, 0);
    prop.add(tip);
  }
  prop.position.z = 4.5;
  plane.add(prop);

  plane.userData.propeller = prop;
  return plane;
}

/** A soft shadow blob that lives in the scene (not on the plane, so banking never tilts it). */
export function makeGroundShadow(THREE) {
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(4.5, 20),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.set(1, 1.6, 1);
  return shadow;
}

/** Apply the flight state to the plane mesh and its ground shadow. */
export function poseAircraft(plane, shadow, state, groundHeight) {
  plane.position.set(state.x, state.y, state.z);
  plane.rotation.set(0, 0, 0);
  plane.rotateY(state.heading);
  plane.rotateX(-state.pitch);
  plane.rotateZ(-state.roll);
  // Propeller spins faster with throttle.
  plane.userData.propeller.rotation.z += (4 + state.throttle * 26) * state.lastDt;
  // Shadow blob sits on the ground, fading with height.
  const heightAbove = Math.max(0, state.y - groundHeight);
  shadow.position.set(state.x, groundHeight + 0.3, state.z);
  shadow.material.opacity = Math.max(0, 0.24 - heightAbove * 0.0012);
  shadow.visible = heightAbove < 200;
}
