// SPDX-License-Identifier: MIT
// Solmar Bay 3D — main: bootstrap, game loop, camera, player movement,
// car enter/exit, shooting, busted/wasted, saves, and ?shot= staging for
// screenshots. The game runs from its own files, no network requests.
(function () {
  'use strict';
  const T = THREE;

  const game = {
    camYaw: 0, camPitch: 0.32, camDist: 12,
    shootT: 0, reloadT: 0, flashT: 0, tracerT: 0,
    saveT: 0, titleAngle: 0, started: false
  };

  function parseQuery() {
    const q = new URLSearchParams(window.location.search);
    SB.state.shot = q.get('shot');
    SB.state.seed = parseInt(q.get('seed') || '1', 10) || 1;
  }

  function saveGame() {
    try {
      const s = SB.state;
      localStorage.setItem(SB.CFG.saveKey, JSON.stringify({
        money: s.money, respect: s.respect, jobsDone: s.jobsDone,
        jobIndex: s.jobIndex, radio: s.radio, cameraMode: s.cameraMode,
        tapes: s.tapes, properties: s.properties,
        x: SB.player ? SB.player.x : 0, z: SB.player ? SB.player.z : 0
      }));
    } catch (err) { /* storage unavailable: play on without saving */ }
  }

  function loadGame() {
    try {
      const raw = localStorage.getItem(SB.CFG.saveKey);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (err) { return null; }
  }

  function applySave(save) {
    if (!save) return;
    const s = SB.state;
    s.money = save.money; s.respect = save.respect || 0;
    s.respectLevel = 1 + Math.floor(s.respect / 400);
    s.jobsDone = save.jobsDone || [];
    s.jobIndex = Math.min(save.jobIndex || 0, SB.JOBS.length - 1);
    s.radio = save.radio || 0; s.cameraMode = save.cameraMode || 'chase';
    s.tapes = save.tapes || 0; s.properties = save.properties || 0;
    SB.Audio.setStation(s.radio);
    if (SB.player && save.x !== undefined) { SB.player.x = save.x; SB.player.z = save.z; }
  }

  function toggleMute() { SB.Audio.setMuted(!SB.state.muted); }

  function newGame() {
    SB.Audio.init();
    SB.Audio.click();
    SB.state = SB.freshState();
    SB.state.mode = 'play';
    SB.Audio.setStation(0);
    spawnWorld();
    showScreen('play');
    SB.say('dez', 'Dez is back in Solmar Bay — and the Undertow owns the tide. Open the map (M) and start LOW TIDE.', 8);
  }

  function continueGame() {
    SB.Audio.init();
    SB.Audio.click();
    const save = loadGame();
    SB.state = SB.freshState();
    applySave(save);
    SB.state.mode = 'play';
    spawnWorld();
    showScreen('play');
  }

  function spawnWorld() {
    // Player on foot at the garage corner, pink sports car beside them.
    if (SB.player) SB.removePerson(SB.player);
    SB.player = SB.makePerson({ kind: 'player', x: -30, z: -84, heading: Math.PI / 2, shirt: 0xff5da2, skin: 0xc98d5f, hair: 0x2b2b2b });
    SB.player.health = 100;
    SB.spawnPlayerCar(-24, -84, Math.PI / 2);
    SB.state.inCar = false;
    SB.state.carHealth = 100;
    SB.state.playerHealth = 100;
    if (SB.vehicles.traffic.length === 0) SB.spawnTraffic(9, SB.rng);
    if (SB.peds.length === 0) SB.spawnPeds(14, SB.rng);
    game.camYaw = SB.player.heading;
  }

  function showScreen(name) {
    const ids = ['title-screen', 'map-screen', 'pause-screen', 'controls-screen', 'hud'];
    ids.forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    if (name === 'play') {
      const hud = document.getElementById('hud');
      if (hud) hud.style.display = 'block';
      SB.state.mode = 'play';
    } else if (name === 'title') {
      document.getElementById('title-screen').style.display = 'flex';
      SB.state.mode = 'title';
    } else if (name === 'map') {
      SB.HUD.drawMap();
      SB.HUD.renderJobList();
      document.getElementById('map-screen').style.display = 'flex';
      SB.state.mode = 'map';
    } else if (name === 'paused') {
      document.getElementById('pause-screen').style.display = 'flex';
      SB.state.mode = 'paused';
    } else if (name === 'controls') {
      document.getElementById('controls-screen').style.display = 'flex';
      SB.state.mode = 'controls';
    }
  }

  function respawn(atX, atZ, message) {
    SB.clearPolice();
    SB.clearEnemies();
    SB.state.wanted = 0;
    SB.state.heat = 0;
    SB.state.playerHealth = 100;
    SB.state.carHealth = 100;
    SB.state.inCar = false;
    if (SB.player) {
      SB.player.x = atX; SB.player.z = atZ;
      SB.player.group.visible = true;
      SB.syncPerson(SB.player);
    }
    SB.spawnPlayerCar(atX + 6, atZ, 0);
    game.camYaw = 0;
    if (message) SB.HUD.notice(message, '', 2600);
  }

  SB.game = game;
  SB.saveGame = saveGame;
  SB.loadGame = loadGame;
  SB.toggleMute = toggleMute;
  SB.newGame = newGame;
  SB.continueGame = continueGame;
  SB.showScreen = showScreen;
  SB.respawn = respawn;
  SB.parseQuery = parseQuery;
  SB.spawnWorld = spawnWorld;
})();

// Camera, movement, entering cars, and shooting.
(function () {
  'use strict';
  const T = THREE;
  const game = SB.game;

  function updateCamera(dt) {
    const cam = SB.view.camera;
    const p = SB.player;
    if (!p) return;
    if (SB.state.mode === 'title') {
      game.titleAngle += dt * 0.06;
      const r = 46;
      cam.position.set(Math.cos(game.titleAngle) * r, 13, Math.sin(game.titleAngle) * r);
      cam.lookAt(0, 6, -20);
      return;
    }
    const car = SB.state.inCar ? SB.vehicles.player : null;
    const focus = car || p;
    const heading = car ? car.heading : p.heading;
    if (SB.state.cameraMode === 'chase') {
      const targetYaw = heading;
      game.camYaw = SB.angleLerp(game.camYaw, targetYaw, Math.min(1, dt * 3.2));
      const dist = car ? 12.5 : 7;
      const height = car ? 4.6 : 3.4;
      const fx = Math.cos(game.camYaw), fz = -Math.sin(game.camYaw);
      const want = new T.Vector3(focus.x - fx * dist, height, focus.z - fz * dist);
      if (game.camSnap) { cam.position.copy(want); game.camSnap = false; }
      else cam.position.lerp(want, Math.min(1, dt * 6));
      cam.lookAt(focus.x + fx * 9, 2.5, focus.z + fz * 9);
    } else {
      // Classic: mouse orbits the camera around the player/car.
      const m = SB.Input.consumeMouse();
      game.camYaw -= m.dx * 0.004;
      game.camPitch = SB.clamp(game.camPitch + m.dy * 0.003, 0.08, 1.1);
      const dist = car ? 13 : 8;
      const cx = focus.x - Math.cos(game.camYaw) * Math.cos(game.camPitch) * dist;
      const cz = focus.z + Math.sin(game.camYaw) * Math.cos(game.camPitch) * dist;
      const cy = 2 + Math.sin(game.camPitch) * dist;
      cam.position.set(cx, cy, cz);
      cam.lookAt(focus.x, 1.6, focus.z);
    }
  }

  function updatePlayerOnFoot(dt) {
    const p = SB.player;
    const ax = SB.Input.axis();
    // Move relative to the camera yaw; the chase camera swings behind.
    const sin = Math.sin(game.camYaw), cos = Math.cos(game.camYaw);
    let mx = 0, mz = 0;
    if (ax.fwd !== 0) { mx += cos * ax.fwd; mz += -sin * ax.fwd; }
    if (ax.strafe !== 0) { mx += sin * ax.strafe; mz += cos * ax.strafe; }
    const len = Math.sqrt(mx * mx + mz * mz);
    const speed = ax.sprint ? SB.CFG.playerSprintSpeed : SB.CFG.playerWalkSpeed;
    if (len > 0) {
      mx /= len; mz /= len;
      p.heading = Math.atan2(-mz, mx);
      const nx = p.x + mx * speed * dt;
      const nz = p.z + mz * speed * dt;
      const hit = SB.collideCircle(nx, nz, 0.7);
      p.x = SB.clamp(hit.x, -246, 246);
      p.z = SB.clamp(hit.z, -246, 246);
      p.speed = speed;
    } else p.speed = 0;
    SB.animateWalk(p, dt);
    SB.syncPerson(p);
    // Enter a nearby car with F (one-shot, so holding F cannot flicker).
    if (SB.Input.pressed('KeyF')) enterNearestCar();
  }

  function nearestCar(x, z, maxD) {
    let best = null, bestD = maxD;
    const consider = function (car) {
      if (!car) return;
      const d = SB.dist2d(car.x, car.z, x, z);
      if (d < bestD) { best = car; bestD = d; }
    };
    SB.vehicles.traffic.forEach(consider);
    SB.vehicles.police.forEach(consider);
    if (SB.vehicles.player) consider(SB.vehicles.player);
    if (SB.Missions.targetCar) consider(SB.Missions.targetCar);
    return best;
  }

  function enterNearestCar() {
    const p = SB.player;
    const car = nearestCar(p.x, p.z, 5.5);
    if (!car) { SB.Audio.denied(); return; }
    const kind = SB.Missions.onCarEntered(car);
    if (kind === 'stolen' || kind === 'target') {
      // The old player car becomes a parked car; the stolen one is now ours.
      if (SB.vehicles.player && SB.vehicles.player !== car) {
        SB.vehicles.player.parked = true;
        SB.vehicles.player.kind = 'traffic';
        SB.vehicles.traffic.push(SB.vehicles.player);
      }
      const i = SB.vehicles.traffic.indexOf(car);
      if (i >= 0) SB.vehicles.traffic.splice(i, 1);
      const j = SB.vehicles.police.indexOf(car);
      if (j >= 0) SB.vehicles.police.splice(j, 1);
      SB.vehicles.player = car;
      car.kind = 'player';
      car.parked = false;
    }
    SB.state.inCar = true;
    SB.state.carHealth = car.health;
    p.group.visible = false;
    game.camYaw = car.heading;
    SB.Audio.click();
  }

  function exitCar() {
    const p = SB.player;
    const car = SB.vehicles.player;
    if (!car) return;
    const side = 2.6;
    const sx = car.x - Math.sin(car.heading) * side;
    const sz = car.z - Math.cos(car.heading) * side;
    const hit = SB.collideCircle(sx, sz, 0.7);
    p.x = hit.x; p.z = hit.z;
    p.heading = car.heading;
    p.group.visible = true;
    SB.syncPerson(p);
    SB.state.inCar = false;
    game.camYaw = p.heading;
    SB.Audio.click();
  }

  SB.updateCamera = updateCamera;
  SB.updatePlayerOnFoot = updatePlayerOnFoot;
  SB.enterNearestCar = enterNearestCar;
  SB.exitCar = exitCar;
  SB.nearestCar = nearestCar;
})();

// Shooting, damage, busted/wasted, the game loop, shot staging and menus.
(function () {
  'use strict';
  const T = THREE;
  const game = SB.game;
  let raycaster = null, muzzle = null, tracer = null;

  function setupCombat() {
    raycaster = new T.Raycaster();
    raycaster.far = 80;
    muzzle = new T.PointLight(0xffe9a8, 0, 22);
    SB.view.scene.add(muzzle);
    const geo = new T.BufferGeometry().setFromPoints([new T.Vector3(), new T.Vector3()]);
    tracer = new T.Line(geo, new T.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0 }));
    SB.view.scene.add(tracer);
    SB._muzzle = muzzle;
    SB._tracer = tracer;
  }

  function shoot() {
    const s = SB.state;
    const w = SB.WEAPONS[s.weapon];
    if (game.shootT > 0 || game.reloadT > 0) return;
    if (s.weapon === 0) { // Fists: hit whatever is right in front.
      const targets = SB.enemies.concat(SB.peds);
      for (let i = 0; i < targets.length; i += 1) {
        const t = targets[i];
        if (t.dead) continue;
        if (SB.dist2d(t.x, t.z, SB.player.x, SB.player.z) < 3.2) { damageTarget(t, w.damage); break; }
      }
      SB.Audio.punch();
      game.shootT = w.rate;
      return;
    }
    if (s.mag[s.weapon] <= 0) { SB.Audio.denied(); game.reloadT = 1.1; return; }
    s.mag[s.weapon] -= 1;
    game.shootT = w.rate;
    SB.Audio.shoot();
    // Hitscan from the camera through the screen centre.
    const cam = SB.view.camera;
    raycaster.setFromCamera(new T.Vector2(0, 0), cam);
    const from = cam.position.clone();
    const dir = new T.Vector3();
    cam.getWorldDirection(dir);
    const targets = SB.enemies.concat(SB.peds);
    let best = null, bestD = w.range;
    for (let i = 0; i < targets.length; i += 1) {
      const t = targets[i];
      if (t.dead) continue;
      const to = new T.Vector3(t.x - from.x, 1.4 - from.y, t.z - from.z);
      const dist = to.length();
      if (dist > w.range) continue;
      to.normalize();
      const angle = to.angleTo(dir);
      if (angle < 0.09 && dist < bestD) { best = t; bestD = dist; }
    }
    const end = from.clone().add(dir.clone().multiplyScalar(best ? bestD : w.range));
    // Muzzle flash + tracer.
    muzzle.position.copy(from).add(dir.clone().multiplyScalar(1.2));
    muzzle.intensity = 3;
    game.flashT = SB.state.shot ? 0.5 : 0.06;
    const pos = tracer.geometry.attributes.position;
    pos.setXYZ(0, muzzle.position.x, muzzle.position.y, muzzle.position.z);
    pos.setXYZ(1, end.x, end.y, end.z);
    pos.needsUpdate = true;
    tracer.material.opacity = 0.9;
    game.tracerT = SB.state.shot ? 0.5 : 0.09;
    if (best) {
      damageTarget(best, w.damage);
      if (best.kind === 'ped') { SB.addWanted(1, 'assault'); }
    }
    // Firing a gun near police draws heat.
    if (SB.vehicles.police.length > 0) SB.addWanted(0, 'shots');
  }

  function damageTarget(t, dmg) {
    t.health -= dmg;
    if (t.health <= 0 && !t.dead) {
      t.dead = true;
      t.group.rotation.x = -Math.PI / 2;
      t.group.position.y = 0.4;
      if (t.kind === 'enemy') SB.Missions.onKill();
    }
  }

  function reload() {
    const s = SB.state;
    const w = SB.WEAPONS[s.weapon];
    if (s.weapon === 0 || game.reloadT > 0) return;
    const need = w.mag - s.mag[s.weapon];
    if (need <= 0 || s.ammo[s.weapon] <= 0) return;
    const take = Math.min(need, s.ammo[s.weapon]);
    s.mag[s.weapon] += take;
    s.ammo[s.weapon] -= take;
    game.reloadT = 1.1;
    SB.Audio.click();
  }

  function onEnemyShot(e) {
    const s = SB.state;
    if (s.mode !== 'play') return;
    if (SB.dist2d(e.x, e.z, SB.player.x, SB.player.z) > 36) return;
    s.playerHealth -= 7 + Math.random() * 5;
    SB.HUD.flashWanted();
    if (s.playerHealth <= 0) wasted();
  }

  function wasted() {
    const s = SB.state;
    if (s.mode === 'dead') return;
    s.mode = 'dead';
    s.money = Math.max(0, s.money - 300);
    SB.HUD.notice('WASTED', 'The bay claims another driver. -$300', 2600);
    SB.Audio.crash();
    setTimeout(function () { SB.respawn(-30, -84, ''); SB.showScreen('play'); }, 2600);
  }

  function onBusted() {
    const s = SB.state;
    if (s.mode === 'busted') return;
    s.mode = 'busted';
    s.money = Math.max(0, s.money - 400);
    SB.HUD.notice('BUSTED', 'The HKPD took you in. -$400', 2600);
    setTimeout(function () {
      SB.failJob('you got busted');
      SB.respawn(-30, -84, '');
      SB.showScreen('play');
    }, 2600);
  }

  function onRam(policeCar, d) {
    const s = SB.state;
    if (!s.inCar || !SB.vehicles.player) return;
    if (d < 4.6) {
      SB.vehicles.player.speed *= 0.86;
      if (game.ramT > 0) return;
      game.ramT = 0.5;
      s.carHealth -= 6;
      SB.Audio.crash();
      if (s.carHealth <= 0) {
        s.carHealth = 0;
        SB.HUD.notice('CAR WRECKED', 'Your ride is done.', 2000);
        SB.exitCar();
      }
    }
  }

  SB.setupCombat = setupCombat;
  SB.shoot = shoot;
  SB.reload = reload;
  SB.onEnemyShot = onEnemyShot;
  SB.wasted = wasted;
  SB.onBusted = onBusted;
  SB.onRam = onRam;
})();

// Game loop, ?shot= staging, menu wiring and boot.
(function () {
  'use strict';
  const game = SB.game;
  let lastT = 0;

  function step(dt) {
    const s = SB.state;
    const now = performance.now() / 1000;
    // Dialogue expiry.
    if (s.dialogue && now > s.dialogue.until) { s.dialogue = null; SB.HUD.hideDialogue(); }
    game.shootT = Math.max(0, game.shootT - dt);
    game.reloadT = Math.max(0, game.reloadT - dt);
    if (game.flashT > 0) { game.flashT -= dt; if (game.flashT <= 0) muzzleOff(); }
    if (game.tracerT > 0) { game.tracerT -= dt; if (game.tracerT <= 0) tracerOff(); }
    if (s.mode !== 'play') return;
    // One-shot keys: camera, radio, job start, mute, weapons, reload.
    if (SB.Input.pressed('KeyV')) { s.cameraMode = s.cameraMode === 'chase' ? 'classic' : 'chase'; }
    if (SB.Input.pressed('KeyQ')) SB.Audio.setStation(SB.state.radio - 1);
    if (SB.Input.pressed('KeyE') && !s.mission) tryStartJob();
    if (SB.Input.pressed('KeyU')) SB.toggleMute();
    if (SB.Input.pressed('Digit0')) s.weapon = 0;
    if (SB.Input.pressed('Digit1')) s.weapon = 1;
    if (SB.Input.pressed('Digit2')) s.weapon = 2;
    if (SB.Input.pressed('KeyR')) SB.reload();
    // Map / pause.
    if (SB.Input.pressed('KeyM')) { SB.showScreen('map'); return; }
    if (SB.Input.pressed('KeyP') || SB.Input.pressed('Escape')) {
      SB.showScreen('paused');
      return;
    }
    // Driving or walking.
    const ax = SB.Input.axis();
    if (s.inCar && SB.vehicles.player) {
      const car = SB.vehicles.player;
      const throttle = ax.fwd;
      const steer = -ax.strafe;
      SB.driveCar(car, throttle, steer, ax.drift, dt);
      s.speedKmh = Math.abs(car.speed) * 2.42;
      SB.Audio.setEngine(Math.abs(car.speed) / SB.CFG.carTopSpeed, true);
      if (SB.Input.pressed('KeyF')) SB.exitCar();
      // Car-car bumps.
      SB.vehicles.traffic.forEach(function (t) { SB.pushCars(car, t); });
      SB.vehicles.police.forEach(function (p) { if (SB.pushCars(car, p) > 0.4) SB.onRam(p, 4); });
    } else {
      SB.updatePlayerOnFoot(dt);
      s.speedKmh = Math.abs(SB.player.speed || 0) * 3.6;
      SB.Audio.setEngine(0, false);
      // Shooting.
      const w = SB.WEAPONS[s.weapon];
      if ((w.auto && SB.Input.isDown()) || (!w.auto && SB.Input.consumeClick())) SB.shoot();
      if (SB.Input.consumeClick()) SB.Input.lockPointer();
    }
    SB.updateTraffic(dt, SB.rng);
    SB.updatePeds(dt, SB.rng);
    SB.updateEnemies(dt, SB.player.x, SB.player.z, SB.onEnemyShot);
    SB.Missions.update(dt);
    SB.Missions.updateJobStartBeacon();
    SB.policeUpdate(dt, {
      x: SB.player.x, z: SB.player.z,
      heading: SB.state.inCar && SB.vehicles.player ? SB.vehicles.player.heading : SB.player.heading,
      inCar: SB.state.inCar,
      car: SB.vehicles.player
    }, SB.rng, SB.onRam, SB.onBusted);
    // Timers: game clock, autosave.
    s.time += dt * 0.02;
    if (s.time >= 24) { s.time -= 24; s.day += 1; }
    if (!s.night && s.time > 20.5) SB.setTimeOfDay(true);
    if (s.night && s.time > 6 && s.time < 12) SB.setTimeOfDay(false);
    game.saveT += dt;
    if (game.saveT > 10) { game.saveT = 0; SB.saveGame(); }
    SB.HUD.updateHUD();
  }

  function muzzleOff() { if (SB._muzzle) SB._muzzle.intensity = 0; }
  function tracerOff() { if (SB._tracer) SB._tracer.material.opacity = 0; }

  function tryStartJob() {
    const sp = SB.Missions.jobStartPoint();
    if (!sp) return;
    if (SB.dist2d(SB.player.x, SB.player.z, sp.x, sp.z) < 10) {
      SB.Audio.click();
      SB.startJob(SB.state.jobIndex);
      SB.Input.consumeInteract(); // the same E press must not auto-complete a pickup later
    }
  }

  function loop(t) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
    lastT = t;
    // Menus: close the map / pause / controls with Esc or the same key.
    if (SB.state.mode === 'map' && (SB.Input.pressed('Escape') || SB.Input.pressed('KeyM'))) { SB.showScreen('play'); }
    else if (SB.state.mode === 'paused' && (SB.Input.pressed('Escape') || SB.Input.pressed('KeyP'))) { SB.showScreen('play'); }
    else if (SB.state.mode === 'controls' && SB.Input.pressed('Escape')) { SB.showScreen('title'); }
    game.ramT = Math.max(0, (game.ramT || 0) - dt);
    step(dt);
    SB.updateCamera(dt);
    SB.view.renderer.render(SB.view.scene, SB.view.camera);
  }

  // Deterministic screenshot scenes. Each stages the real game, then the
  // loop keeps it alive so the frame is what a player actually sees.
  function stageShot() {
    const shot = SB.state.shot;
    if (!shot || shot === 'title') return;
    SB.Audio.init();
    SB.state.mode = 'play';
    if (shot === 'chase') stageChase();
    else if (shot === 'shoot') stageShoot();
    else if (shot === 'map') stageMap();
    SB.showScreen(SB.state.mode === 'map' ? 'map' : 'play');
    if (SB.state.mode === 'play') document.getElementById('hud').style.display = 'block';
  }

  function stageChase() {
    const s = SB.state;
    s.money = 38420; s.day = 1; s.time = 18.9;
    SB.setTimeOfDay(false);
    // Westbound into the sunset: the sun sits ahead of the chase camera.
    SB.spawnPlayerCar(120, 0, Math.PI);
    const car = SB.vehicles.player;
    car.speed = 55;
    s.inCar = true;
    s.carHealth = 100;
    SB.player.group.visible = false;
    SB.player.x = 120; SB.player.z = 0;
    SB.setWanted(3);
    // Police in frame: one alongside each side, one ahead.
    const p1 = SB.spawnPoliceCar(96, 6, Math.PI);
    const p2 = SB.spawnPoliceCar(102, -6, Math.PI);
    const p3 = SB.spawnPoliceCar(78, 1, Math.PI);
    p1.speed = 36; p2.speed = 37; p3.speed = 34;
    SB.makeHeli();
    SB.vehicles.heli.x = 0; SB.vehicles.heli.z = -14;
    SB.startJob(4); // PAPER MOON, escape stage, 2:06 on the clock.
    SB.state.mission.timer = 126;
    SB.say('juno', "Alarms are back! You've got the whole department coming — lose them!", 30);
    game.camYaw = Math.PI;
    game.camSnap = true;
  }

  function stageShoot() {
    const s = SB.state;
    s.money = 9850; s.day = 1; s.time = 21.7;
    SB.setTimeOfDay(true);
    SB.player.x = -66; SB.player.z = -52;
    SB.player.heading = 0.62; // face the crew by Club Voltage
    SB.syncPerson(SB.player);
    SB.player.group.visible = true;
    s.inCar = false;
    s.weapon = 2; // WASP SMG.
    SB.startJob(2); // UNDERTOW.
    SB.state.mission.stageIndex = 1;
    SB.state.mission.kills = 0;
    SB.state.objective = 'Take out the Undertow crew — 0/6 down';
    SB.spawnEnemies(3, -52, -62, 14, SB.rng);
    SB.say('silas', 'Calloway. You should have stayed in your cell. Boys — wash him out.', 30);
    game.camYaw = SB.player.heading;
    game.camSnap = true;
    // One shot mid-flight so the frame shows the muzzle flash + tracer.
    setTimeout(function () { SB.shoot(); }, 600);
  }

  function stageMap() {
    const s = SB.state;
    s.money = 41250; s.respect = 1350; s.respectLevel = 4;
    s.tapes = 7; s.properties = 2; s.day = 3; s.time = 18.7;
    s.jobsDone = ['low-tide', 'cold-cargo', 'undertow', 'blue-lights'];
    s.jobIndex = 4;
    SB.setTimeOfDay(false);
    SB.player.x = 30; SB.player.z = 30;
    SB.syncPerson(SB.player);
    SB.startJob(4);
    SB.state.mission.timer = 96;
    SB.state.mode = 'map';
    game.camYaw = 0;
  }

  function bindMenus() {
    const on = function (id, fn) {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', fn);
    };
    on('btn-new', function () { SB.newGame(); });
    on('btn-continue', function () { SB.continueGame(); });
    on('btn-controls', function () { SB.showScreen('controls'); });
    on('btn-back-title', function () { SB.showScreen('title'); });
    on('btn-resume', function () { SB.showScreen('play'); });
    on('btn-quit-title', function () { SB.saveGame(); SB.showScreen('title'); });
    on('btn-close-map', function () { SB.showScreen('play'); });
    on('btn-start-job', function () {
      SB.Audio.click();
      if (!SB.state.mission) SB.startJob(SB.state.jobIndex);
      SB.showScreen('play');
    });
    on('btn-settings', function () { SB.toggleMute(); SB.Audio.click(); });
    // Start screen portraits.
    ['dez', 'pearl', 'juno', 'mags', 'ben', 'silas'].forEach(function (k) {
      SB.HUD.drawPortrait(document.getElementById('portrait-' + k), k);
    });
    const save = SB.loadGame();
    const cont = document.getElementById('btn-continue');
    if (cont) {
      cont.style.display = save ? 'block' : 'none';
      if (save) {
        const sub = document.getElementById('continue-sub');
        if (sub) sub.textContent = 'Ch. ' + (save.jobIndex + 1) + ' · ' + SB.HUD.fmtMoney(save.money) + ' · Day ' + (save.day || 1);
      }
    }
  }

  function boot() {
    SB.parseQuery();
    SB.rng = SB.mulberry32(SB.hashSeed('solmar-bay-' + SB.state.seed));
    SB.buildWorld();
    SB.setupCombat();
    SB.spawnWorld();
    bindMenus();
    SB.showScreen('title');
    stageShot();
    requestAnimationFrame(loop);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
