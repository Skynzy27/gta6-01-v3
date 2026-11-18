// SPDX-License-Identifier: MIT
// Solmar Bay 3D — vehicles: box-built low-poly cars and the police
// helicopter, plus arcade driving physics and traffic that follows the
// road grid. Everything is plain Three.js boxes and cylinders.
(function () {
  'use strict';
  const T = THREE;

  const vehicles = { player: null, traffic: [], police: [], heli: null };
  const TRAFFIC_COLOURS = [0xd8d8d8, 0x3a6fd6, 0xd6a23a, 0x4ad67a, 0x8a5fd6, 0xc0c8d0, 0x2a2d33];

  function box(w, h, d, colour, x, y, z) {
    const m = new T.Mesh(new T.BoxGeometry(w, h, d), new T.MeshLambertMaterial({ color: colour }));
    m.position.set(x, y, z);
    return m;
  }

  function glowBox(w, h, d, colour, x, y, z) {
    const m = new T.Mesh(new T.BoxGeometry(w, h, d), new T.MeshBasicMaterial({ color: colour }));
    m.position.set(x, y, z);
    return m;
  }

  // A car is a group: body, cabin, 4 wheels, lights. Heading 0 faces +x.
  function makeCar(opts) {
    const g = new T.Group();
    const colour = opts.colour;
    const body = box(4.6, 0.85, 2.0, colour, 0, 0.72, 0);
    g.add(body);
    const cabin = box(2.3, 0.75, 1.75, opts.cabin || 0x1c2733, -0.25, 1.45, 0);
    g.add(cabin);
    const wheels = [];
    [[1.5, 0.95], [1.5, -0.95], [-1.5, 0.95], [-1.5, -0.95]].forEach(function (p) {
      const w = new T.Mesh(new T.CylinderGeometry(0.42, 0.42, 0.32, 10), new T.MeshLambertMaterial({ color: 0x14161a }));
      w.rotation.x = Math.PI / 2;
      w.position.set(p[0], 0.42, p[1]);
      g.add(w);
      wheels.push(w);
    });
    // Headlights + taillights.
    g.add(glowBox(0.12, 0.22, 0.4, 0xfff2b0, 2.32, 0.72, 0.62));
    g.add(glowBox(0.12, 0.22, 0.4, 0xfff2b0, 2.32, 0.72, -0.62));
    g.add(glowBox(0.12, 0.22, 0.4, 0xff2a2a, -2.32, 0.72, 0.62));
    g.add(glowBox(0.12, 0.22, 0.4, 0xff2a2a, -2.32, 0.72, -0.62));
    if (opts.sport) {
      g.add(box(0.18, 0.08, 1.9, 0x14161a, -2.2, 1.25, 0));
      g.add(box(0.1, 0.5, 0.1, 0x14161a, -2.15, 1.0, 0.8));
      g.add(box(0.1, 0.5, 0.1, 0x14161a, -2.15, 1.0, -0.8));
    }
    let lightBar = null;
    if (opts.police) {
      lightBar = new T.Group();
      const red = glowBox(0.7, 0.22, 0.5, 0xff2222, 0, 1.95, 0.45);
      const blue = glowBox(0.7, 0.22, 0.5, 0x2244ff, 0, 1.95, -0.45);
      lightBar.add(red); lightBar.add(blue);
      lightBar.userData.red = red; lightBar.userData.blue = blue;
      g.add(lightBar);
      const stripe = box(4.62, 0.3, 2.02, 0x11131a, 0, 0.72, 0);
      g.add(stripe);
    }
    g.position.set(opts.x || 0, 0, opts.z || 0);
    g.rotation.y = -(opts.heading || 0);
    SB.view.scene.add(g);
    const car = {
      group: g, kind: opts.kind || 'traffic', colour: colour,
      x: opts.x || 0, z: opts.z || 0, heading: opts.heading || 0,
      speed: 0, steer: 0, health: 100, wheels: wheels, lightBar: lightBar,
      flashT: 0, cruise: opts.cruise || 0, roadAxis: opts.roadAxis || 'x',
      roadLine: opts.roadLine || 0, driver: opts.driver !== false, stuck: 0
    };
    return car;
  }

  function spawnPlayerCar(x, z, heading) {
    if (vehicles.player) { SB.view.scene.remove(vehicles.player.group); }
    const car = makeCar({ kind: 'player', colour: SB.CFG.colours.playerCar, sport: true, x: x, z: z, heading: heading });
    vehicles.player = car;
    return car;
  }

  function spawnTraffic(n, rng) {
    for (let i = 0; i < n; i += 1) {
      const axis = rng() < 0.5 ? 'x' : 'z';
      const line = SB.CFG.roads[Math.floor(rng() * SB.CFG.roads.length)];
      const along = -230 + rng() * 460;
      const heading = (Math.floor(rng() * 4) * Math.PI) / 2;
      const car = makeCar({
        kind: 'traffic',
        colour: TRAFFIC_COLOURS[Math.floor(rng() * TRAFFIC_COLOURS.length)],
        x: axis === 'x' ? along : line, z: axis === 'x' ? line : along,
        heading: heading, cruise: 11 + rng() * 8, roadAxis: axis, roadLine: line
      });
      car.speed = car.cruise;
      vehicles.traffic.push(car);
    }
  }

  function spawnPoliceCar(x, z, heading) {
    const car = makeCar({
      kind: 'police', colour: SB.CFG.colours.policeCar, police: true,
      cabin: 0x11131a, x: x, z: z, heading: heading, cruise: 30
    });
    vehicles.police.push(car);
    return car;
  }

  function removeCar(car) {
    SB.view.scene.remove(car.group);
    ['traffic', 'police'].forEach(function (list) {
      const i = vehicles[list].indexOf(car);
      if (i >= 0) vehicles[list].splice(i, 1);
    });
  }

  SB.vehicles = vehicles;
  SB.makeCar = makeCar;
  SB.spawnPlayerCar = spawnPlayerCar;
  SB.spawnTraffic = spawnTraffic;
  SB.spawnPoliceCar = spawnPoliceCar;
  SB.removeCar = removeCar;
})();

// Arcade driving, traffic AI and the police helicopter.
(function () {
  'use strict';
  const T = THREE;

  // Player driving: throttle -1..1, steer -1..1, drift bool.
  function driveCar(car, throttle, steer, drift, dt) {
    const C = SB.CFG;
    if (throttle > 0) car.speed += C.carAccel * throttle * dt;
    else if (throttle < 0) {
      if (car.speed > 0.5) car.speed -= C.carBrake * dt;
      else car.speed = Math.max(car.speed + C.carAccel * 0.6 * throttle * dt, -C.carReverseTop);
    }
    // Drag + rolling resistance.
    car.speed -= car.speed * 0.55 * dt;
    if (Math.abs(car.speed) < 0.05 && throttle === 0) car.speed = 0;
    car.speed = SB.clamp(car.speed, -C.carReverseTop, C.carTopSpeed);
    const spd = Math.abs(car.speed);
    const grip = drift ? 0.45 : 1;
    const turnRate = (spd > 0.1 ? 1.9 * Math.min(1, spd / 14) * grip : 0) * (drift ? 1.7 : 1);
    car.heading += steer * turnRate * dt * (car.speed < 0 ? -1 : 1);
    const fx = Math.cos(car.heading), fz = -Math.sin(car.heading);
    let nx = car.x + fx * car.speed * dt;
    let nz = car.z + fz * car.speed * dt;
    const hit = SB.collideCircle(nx, nz, 2.3);
    if (hit.hit) {
      car.speed *= 0.45;
      if (car.kind === 'player') SB.Audio.crash();
      nx = hit.x; nz = hit.z;
    }
    nx = SB.clamp(nx, -246, 246);
    nz = SB.clamp(nz, -246, 246);
    car.x = nx; car.z = nz;
    car.group.position.set(car.x, 0, car.z);
    car.group.rotation.y = -car.heading;
    // Wheel spin + front-wheel steer.
    const spin = car.speed * dt / 0.42;
    car.wheels.forEach(function (w, i) {
      w.rotation.y += spin;
      if (i < 2) w.rotation.z = steer * 0.4;
    });
    // Police light bar flash.
    if (car.lightBar) {
      car.flashT += dt;
      const phase = Math.floor(car.flashT * 6) % 2 === 0;
      car.lightBar.userData.red.visible = phase;
      car.lightBar.userData.blue.visible = !phase;
    }
  }

  // Traffic follows the road grid, axis-aligned, turning at intersections.
  function updateTraffic(dt, rng) {
    const cars = SB.vehicles.traffic;
    for (let i = 0; i < cars.length; i += 1) {
      const car = cars[i];
      const fx = Math.cos(car.heading), fz = -Math.sin(car.heading);
      let nx = car.x + fx * car.speed * dt;
      let nz = car.z + fz * car.speed * dt;
      // At an intersection, sometimes turn.
      const nearX = SB.CFG.roads.some(function (r) { return Math.abs(nx - r) < 3; });
      const nearZ = SB.CFG.roads.some(function (r) { return Math.abs(nz - r) < 3; });
      if (nearX && nearZ && rng() < dt * 0.5) {
        car.heading += (rng() < 0.5 ? 1 : -1) * Math.PI / 2;
      }
      // Stay on the road line: ease back to it.
      if (car.roadAxis === 'x') nz += (car.roadLine - nz) * Math.min(1, dt * 1.2);
      else nx += (car.roadLine - nx) * Math.min(1, dt * 1.2);
      const hit = SB.collideCircle(nx, nz, 2.2);
      if (hit.hit) { car.heading += Math.PI / 2; nx = car.x; nz = car.z; }
      car.x = SB.clamp(nx, -246, 246);
      car.z = SB.clamp(nz, -246, 246);
      car.speed = car.cruise;
      car.group.position.set(car.x, 0, car.z);
      car.group.rotation.y = -car.heading;
      const spin = car.speed * dt / 0.42;
      car.wheels.forEach(function (w) { w.rotation.y += spin; });
    }
  }

  // Simple circle push between two cars; returns overlap depth.
  function pushCars(a, b) {
    const dx = b.x - a.x, dz = b.z - a.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    const min = 4.4;
    if (d >= min || d === 0) return 0;
    const push = (min - d) / 2;
    const ux = dx / d, uz = dz / d;
    a.x -= ux * push; a.z -= uz * push;
    b.x += ux * push; b.z += uz * push;
    return min - d;
  }

  // Police helicopter: box body, tail, spinning rotor, spotlight cone.
  function makeHeli() {
    const g = new T.Group();
    const body = new T.Mesh(new T.BoxGeometry(4.2, 1.6, 2.2), new T.MeshLambertMaterial({ color: 0x22242e }));
    body.position.y = 0;
    g.add(body);
    const cab = new T.Mesh(new T.BoxGeometry(1.8, 1.2, 1.8), new T.MeshLambertMaterial({ color: 0x9fd8ff }));
    cab.position.set(1.6, 0.2, 0);
    g.add(cab);
    const tail = new T.Mesh(new T.BoxGeometry(4.5, 0.5, 0.5), new T.MeshLambertMaterial({ color: 0x22242e }));
    tail.position.set(-4, 0.3, 0);
    g.add(tail);
    const rotor = new T.Mesh(new T.BoxGeometry(11, 0.12, 0.7), new T.MeshLambertMaterial({ color: 0x14161a }));
    rotor.position.y = 1.3;
    g.add(rotor);
    const tailRotor = new T.Mesh(new T.BoxGeometry(0.12, 2.2, 0.5), new T.MeshLambertMaterial({ color: 0x14161a }));
    tailRotor.position.set(-6, 0.4, 0);
    g.add(tailRotor);
    const spot = new T.SpotLight(0xfff2b0, 2.2, 90, 0.32, 0.5, 1.2);
    spot.position.set(0, -0.8, 0);
    g.add(spot);
    g.add(spot.target);
    const cone = new T.Mesh(
      new T.ConeGeometry(7, 42, 16, 1, true),
      new T.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.13, side: T.DoubleSide, depthWrite: false })
    );
    cone.position.y = -21; // apex at the heli, base at the ground
    g.add(cone);
    SB.view.scene.add(g);
    const heli = { group: g, rotor: rotor, tailRotor: tailRotor, spot: spot, cone: cone, x: 0, z: 0, y: 42, heading: 0 };
    SB.vehicles.heli = heli;
    return heli;
  }

  function updateHeli(dt, px, pz) {
    const heli = SB.vehicles.heli;
    if (!heli) return;
    heli.rotor.rotation.y += dt * 22;
    heli.tailRotor.rotation.x += dt * 30;
    // Lag-chase the player from above.
    heli.x = SB.lerp(heli.x, px, Math.min(1, dt * 0.9));
    heli.z = SB.lerp(heli.z, pz, Math.min(1, dt * 0.9));
    heli.y = 26 + Math.sin(performance.now() / 900) * 1.5;
    heli.heading = Math.atan2(-(pz - heli.z), px - heli.x);
    heli.group.position.set(heli.x, heli.y, heli.z);
    heli.group.rotation.y = -heli.heading;
    heli.spot.target.position.set(px - heli.x, -heli.y, pz - heli.z);
    // The cone hangs straight down from the heli (child of the group).
  }

  function removeHeli() {
    const heli = SB.vehicles.heli;
    if (heli) { SB.view.scene.remove(heli.group); SB.vehicles.heli = null; }
  }

  SB.driveCar = driveCar;
  SB.updateTraffic = updateTraffic;
  SB.pushCars = pushCars;
  SB.makeHeli = makeHeli;
  SB.updateHeli = updateHeli;
  SB.removeHeli = removeHeli;
})();
