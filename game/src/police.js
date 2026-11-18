// SPDX-License-Identifier: MIT
// Solmar Bay 3D — police: the wanted system (0-5 stars), police pursuit,
// roadblocks, the helicopter, and getting busted. Heat only fades while the
// player is hidden: no police close, no helicopter overhead.
(function () {
  'use strict';

  const police = { units: [], roadblocks: [], wantedTarget: 0, spawnT: 0 };

  function wantedCount() {
    const w = SB.state.wanted;
    if (w <= 0) return 0;
    if (w === 1) return 2;
    if (w === 2) return 3;
    if (w === 3) return 4;
    if (w === 4) return 5;
    return 6;
  }

  function addWanted(n, reason) {
    const s = SB.state;
    const before = s.wanted;
    s.wanted = SB.clamp(s.wanted + n, 0, SB.CFG.wantedMax);
    s.heat = 1;
    s.hiddenTimer = 0;
    if (s.wanted > before) SB.Audio.wantedUp();
    if (s.wanted > 0) SB.HUD.flashWanted();
    return s.wanted;
  }

  function setWanted(n) {
    SB.state.wanted = SB.clamp(n, 0, SB.CFG.wantedMax);
    SB.state.heat = n > 0 ? 1 : 0;
    SB.state.hiddenTimer = 0;
  }

  // Spotted: a police car within 55 units, or the helicopter overhead while
  // the player is out in the open. While spotted, heat never decays.
  function computeSpotted(px, pz) {
    const s = SB.state;
    let spotted = false;
    for (let i = 0; i < SB.vehicles.police.length; i += 1) {
      const c = SB.vehicles.police[i];
      if (SB.dist2d(c.x, c.z, px, pz) < 55) { spotted = true; break; }
    }
    const heli = SB.vehicles.heli;
    if (heli && SB.dist2d(heli.x, heli.z, px, pz) < 46) spotted = true;
    s.spotted = spotted;
    return spotted;
  }

  function ensureUnits(px, pz, rng) {
    const want = wantedCount();
    const have = SB.vehicles.police.length;
    if (have < want) {
      for (let i = have; i < want; i += 1) {
        const a = rng() * Math.PI * 2;
        const d = 70 + rng() * 50;
        SB.spawnPoliceCar(
          SB.clamp(px + Math.cos(a) * d, -240, 240),
          SB.clamp(pz + Math.sin(a) * d, -240, 240),
          Math.atan2(-(pz - (pz + Math.sin(a) * d)), px - (px + Math.cos(a) * d))
        );
      }
    } else if (have > want) {
      // Remove the farthest units first.
      const sorted = SB.vehicles.police.slice().sort(function (a, b) {
        return SB.dist2d(b.x, b.z, px, pz) - SB.dist2d(a.x, a.z, px, pz);
      });
      for (let i = 0; i < have - want; i += 1) SB.removeCar(sorted[i]);
    }
    // Helicopter joins at 3 stars, leaves when heat is gone.
    if (SB.state.wanted >= 3 && !SB.vehicles.heli) SB.makeHeli();
    if (SB.state.wanted < 3 && SB.vehicles.heli) SB.removeHeli();
  }

  // Pursuit: steer toward the player, faster than traffic, ramming on touch.
  function updatePolice(dt, px, pz, playerCar, onRam) {
    const cars = SB.vehicles.police;
    for (let i = 0; i < cars.length; i += 1) {
      const c = cars[i];
      if (c.roadblock) {
        // Parked across the road: only flash the light bar.
        c.flashT += dt;
        const phase = Math.floor(c.flashT * 6) % 2 === 0;
        if (c.lightBar) {
          c.lightBar.userData.red.visible = phase;
          c.lightBar.userData.blue.visible = !phase;
        }
        continue;
      }
      const d = SB.dist2d(c.x, c.z, px, pz);
      const wantHeading = Math.atan2(-(pz - c.z), px - c.x);
      let diff = wantHeading - c.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const steer = SB.clamp(diff * 2.2, -1, 1);
      const targetSpeed = d > 26 ? 34 : 26;
      c.speed += (targetSpeed - c.speed) * Math.min(1, dt * 0.8);
      c.heading += steer * 2.4 * dt * Math.min(1, c.speed / 12);
      const fx = Math.cos(c.heading), fz = -Math.sin(c.heading);
      let nx = c.x + fx * c.speed * dt;
      let nz = c.z + fz * c.speed * dt;
      const hit = SB.collideCircle(nx, nz, 2.3);
      if (hit.hit) { nx = hit.x; nz = hit.z; c.speed *= 0.6; }
      c.x = SB.clamp(nx, -246, 246);
      c.z = SB.clamp(nz, -246, 246);
      c.group.position.set(c.x, 0, c.z);
      c.group.rotation.y = -c.heading;
      const spin = c.speed * dt / 0.42;
      c.wheels.forEach(function (w) { w.rotation.y += spin; });
      c.flashT += dt;
      const phase = Math.floor(c.flashT * 6) % 2 === 0;
      if (c.lightBar) {
        c.lightBar.userData.red.visible = phase;
        c.lightBar.userData.blue.visible = !phase;
      }
      // Ram: contact with the player's car damages it.
      if (playerCar && d < 4.6 && onRam) onRam(c, d);
    }
  }

  SB.police = police;
  SB.addWanted = addWanted;
  SB.setWanted = setWanted;
  SB.computeSpotted = computeSpotted;
  SB.ensureUnits = ensureUnits;
  SB.updatePolice = updatePolice;
  SB.wantedCount = wantedCount;
})();

// Roadblocks, heat decay and getting busted.
(function () {
  'use strict';

  function ensureRoadblocks(px, pz, heading, rng) {
    const want = SB.state.wanted >= 4 ? 1 : 0;
    if (want && SB.police.roadblocks.length === 0) {
      // Two police cars parked across the road ahead of the player.
      const fx = Math.cos(heading), fz = -Math.sin(heading);
      const cx = px + fx * 46, cz = pz + fz * 46;
      const a = SB.spawnPoliceCar(cx - fz * 5, cz + fx * 5, heading + Math.PI / 2);
      const b = SB.spawnPoliceCar(cx + fz * 5, cz - fx * 5, heading - Math.PI / 2);
      a.speed = 0; b.speed = 0; a.roadblock = true; b.roadblock = true;
      SB.police.roadblocks.push(a, b);
    } else if (!want && SB.police.roadblocks.length > 0) {
      SB.police.roadblocks.forEach(function (c) { SB.removeCar(c); });
      SB.police.roadblocks.length = 0;
    }
  }

  // Heat decay: only while hidden. Returns true when a star just faded.
  function decayHeat(dt) {
    const s = SB.state;
    if (s.wanted <= 0) { s.heat = 0; return false; }
    if (s.spotted) { s.hiddenTimer = 0; return false; }
    s.hiddenTimer += dt;
    if (s.hiddenTimer > 5) {
      s.heat -= dt / 4;
      if (s.heat <= 0) {
        s.wanted -= 1;
        s.heat = s.wanted > 0 ? 1 : 0;
        s.hiddenTimer = 0;
        return true;
      }
    }
    return false;
  }

  // On foot, a police car touching the player for 1.5s busts them.
  function bustedCheck(dt, px, pz, inCar) {
    const s = SB.state;
    if (inCar || s.wanted <= 0) { s.bustedTimer = 0; return false; }
    let near = false;
    for (let i = 0; i < SB.vehicles.police.length; i += 1) {
      if (SB.dist2d(SB.vehicles.police[i].x, SB.vehicles.police[i].z, px, pz) < 3.4) { near = true; break; }
    }
    if (near) {
      s.bustedTimer += dt;
      if (s.bustedTimer > 1.5) { s.bustedTimer = 0; return true; }
    } else s.bustedTimer = 0;
    return false;
  }

  function clearAll() {
    SB.vehicles.police.slice().forEach(function (c) { SB.removeCar(c); });
    SB.police.roadblocks.length = 0;
    SB.removeHeli();
    SB.setWanted(0);
  }

  // One tick of the whole wanted system. `pos` is {x, z, heading, inCar, car}.
  function update(dt, pos, rng, onRam, onBusted) {
    SB.computeSpotted(pos.x, pos.z);
    SB.ensureUnits(pos.x, pos.z, rng);
    SB.ensureRoadblocks(pos.x, pos.z, pos.heading, rng);
    SB.updatePolice(dt, pos.x, pos.z, pos.car, onRam);
    if (SB.vehicles.heli) SB.updateHeli(dt, pos.x, pos.z);
    SB.decayHeat(dt);
    if (SB.bustedCheck(dt, pos.x, pos.z, pos.inCar) && onBusted) onBusted();
    SB.Audio.setSiren(SB.vehicles.police.length > 0 && SB.dist2d(
      SB.vehicles.police[0].x, SB.vehicles.police[0].z, pos.x, pos.z) < 90);
  }

  SB.decayHeat = decayHeat;
  SB.bustedCheck = bustedCheck;
  SB.clearPolice = clearAll;
  SB.policeUpdate = update;
  SB.ensureRoadblocks = ensureRoadblocks;
})();
