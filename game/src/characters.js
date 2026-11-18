// SPDX-License-Identifier: MIT
// Solmar Bay 3D — characters: blocky low-poly people. One factory builds the
// player, pedestrians and enemies; walk cycles swing arms and legs.
(function () {
  'use strict';
  const T = THREE;

  const SKINS = [0xc98d5f, 0xe8b88a, 0x8a5a3b, 0xa06a42, 0xd9a06a, 0xe8c39a];
  const SHIRTS = [0xff5da2, 0x5cd6d6, 0xffc21c, 0x4ad67a, 0x8a5fd6, 0xe8e8e8, 0xff8a5c, 0x3a6fd6];
  const PANTS = [0x2a2d33, 0x3a4a6a, 0x5a3a2a, 0x4a4a4a];

  function makePerson(opts) {
    const g = new T.Group();
    const skin = opts.skin || SKINS[Math.floor(Math.random() * SKINS.length)];
    const shirt = opts.shirt || SHIRTS[Math.floor(Math.random() * SHIRTS.length)];
    const pants = opts.pants || PANTS[Math.floor(Math.random() * PANTS.length)];
    const mat = function (c) { return new T.MeshLambertMaterial({ color: c }); };
    // Legs (pivot at hip for the walk swing).
    const legL = new T.Mesh(new T.BoxGeometry(0.34, 0.85, 0.34), mat(pants));
    legL.position.set(0, 0.42, 0.2);
    legL.geometry.translate(0, -0.42, 0);
    legL.position.y = 0.85;
    const legR = legL.clone();
    legR.position.z = -0.2;
    // Torso.
    const torso = new T.Mesh(new T.BoxGeometry(0.62, 0.85, 0.95), mat(shirt));
    torso.position.y = 1.28;
    // Arms (pivot at shoulder).
    const armL = new T.Mesh(new T.BoxGeometry(0.26, 0.8, 0.26), mat(shirt));
    armL.geometry.translate(0, -0.4, 0);
    armL.position.set(0, 1.62, 0.62);
    const armR = armL.clone();
    armR.position.z = -0.62;
    // Head + hair.
    const head = new T.Mesh(new T.BoxGeometry(0.5, 0.5, 0.5), mat(skin));
    head.position.y = 1.98;
    const hair = new T.Mesh(new T.BoxGeometry(0.54, 0.2, 0.54), mat(opts.hair || 0x2b2b2b));
    hair.position.y = 2.28;
    g.add(legL); g.add(legR); g.add(torso); g.add(armL); g.add(armR); g.add(head); g.add(hair);
    if (opts.hat) {
      const hat = new T.Mesh(new T.BoxGeometry(0.7, 0.12, 0.7), mat(opts.hat));
      hat.position.y = 2.38;
      g.add(hat);
    }
    g.position.set(opts.x || 0, 0, opts.z || 0);
    g.rotation.y = -(opts.heading || 0);
    SB.view.scene.add(g);
    return {
      group: g, kind: opts.kind || 'ped',
      x: opts.x || 0, z: opts.z || 0, heading: opts.heading || 0,
      speed: 0, walkPhase: Math.random() * 6, health: opts.health || 100,
      legL: legL, legR: legR, armL: armL, armR: armR,
      target: null, shootT: 0, dead: false, fadeT: 0
    };
  }

  // Walk cycle: legs and arms swing opposite, slight torso bob.
  function animateWalk(p, dt) {
    p.walkPhase += dt * (2 + Math.abs(p.speed) * 1.1);
    const s = Math.sin(p.walkPhase) * SB.clamp(Math.abs(p.speed) / 6, 0.15, 1);
    p.legL.rotation.x = s * 0.7;
    p.legR.rotation.x = -s * 0.7;
    p.armL.rotation.x = -s * 0.5;
    p.armR.rotation.x = s * 0.5;
    p.group.position.y = Math.abs(Math.sin(p.walkPhase)) * 0.06;
  }

  function syncPerson(p) {
    p.group.position.set(p.x, p.group.position.y, p.z);
    p.group.rotation.y = -p.heading;
  }

  function removePerson(p) { SB.view.scene.remove(p.group); }

  SB.makePerson = makePerson;
  SB.animateWalk = animateWalk;
  SB.syncPerson = syncPerson;
  SB.removePerson = removePerson;
  SB.peds = [];
  SB.enemies = [];
})();

// Pedestrians wander the sidewalks; enemies hold a spot and shoot back.
(function () {
  'use strict';

  function spawnPeds(n, rng) {
    for (let i = 0; i < n; i += 1) {
      const axis = rng() < 0.5 ? 'x' : 'z';
      const line = SB.CFG.roads[Math.floor(rng() * SB.CFG.roads.length)];
      const along = -230 + rng() * 460;
      const off = (rng() < 0.5 ? -1 : 1) * (9 + rng() * 3);
      const p = SB.makePerson({
        kind: 'ped',
        x: axis === 'x' ? along : line + off,
        z: axis === 'x' ? line + off : along,
        heading: Math.floor(rng() * 4) * Math.PI / 2
      });
      p.speed = 1.2 + rng() * 1.2;
      p.axis = axis; p.line = line; p.off = off;
      SB.peds.push(p);
    }
  }

  function updatePeds(dt, rng) {
    for (let i = 0; i < SB.peds.length; i += 1) {
      const p = SB.peds[i];
      if (p.dead) continue;
      // Walk along the sidewalk; turn around at the city edge, sometimes
      // change direction at an intersection.
      const fx = Math.cos(p.heading), fz = -Math.sin(p.heading);
      let nx = p.x + fx * p.speed * dt;
      let nz = p.z + fz * p.speed * dt;
      if (Math.abs(nx) > 240 || Math.abs(nz) > 240) { p.heading += Math.PI; nx = p.x; nz = p.z; }
      const nearX = SB.CFG.roads.some(function (r) { return Math.abs(nx - r) < 2; });
      const nearZ = SB.CFG.roads.some(function (r) { return Math.abs(nz - r) < 2; });
      if (nearX && nearZ && rng() < dt * 0.25) p.heading += (rng() < 0.5 ? 1 : -1) * Math.PI / 2;
      const hit = SB.collideCircle(nx, nz, 0.6);
      p.x = hit.x; p.z = hit.z;
      SB.animateWalk(p, dt);
      SB.syncPerson(p);
    }
  }

  function spawnEnemies(count, x, z, r, rng) {
    const out = [];
    for (let i = 0; i < count; i += 1) {
      const a = rng() * Math.PI * 2;
      const d = 4 + rng() * r;
      const e = SB.makePerson({
        kind: 'enemy',
        x: SB.clamp(x + Math.cos(a) * d, -240, 240),
        z: SB.clamp(z + Math.sin(a) * d, -240, 240),
        shirt: 0x3a3f4a, pants: 0x2a2d33, hair: 0x111111, health: 100
      });
      SB.enemies.push(e);
      out.push(e);
    }
    return out;
  }

  // Enemies stand their ground and shoot at the player when close.
  function updateEnemies(dt, px, pz, onShot) {
    for (let i = SB.enemies.length - 1; i >= 0; i -= 1) {
      const e = SB.enemies[i];
      if (e.dead) {
        e.fadeT += dt;
        e.group.position.y = -e.fadeT * 0.4;
        if (e.fadeT > 1.2) { SB.removePerson(e); SB.enemies.splice(i, 1); }
        continue;
      }
      const d = SB.dist2d(e.x, e.z, px, pz);
      e.heading = Math.atan2(-(pz - e.z), px - e.x);
      e.shootT -= dt;
      if (d < 34 && e.shootT <= 0) {
        e.shootT = 1.1 + Math.random() * 0.9;
        if (onShot) onShot(e);
      }
      // Face the player, slight strafe.
      e.x += Math.cos(e.heading + Math.PI / 2) * Math.sin(performance.now() / 700 + i) * dt * 0.8;
      SB.animateWalk(e, dt * 0.4);
      SB.syncPerson(e);
    }
  }

  function clearEnemies() {
    SB.enemies.forEach(function (e) { SB.removePerson(e); });
    SB.enemies.length = 0;
  }

  SB.spawnPeds = spawnPeds;
  SB.updatePeds = updatePeds;
  SB.spawnEnemies = spawnEnemies;
  SB.updateEnemies = updateEnemies;
  SB.clearEnemies = clearEnemies;
})();
