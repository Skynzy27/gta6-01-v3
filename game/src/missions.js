// SPDX-License-Identifier: MIT
// Solmar Bay 3D — missions: the story-job engine. Jobs are data in
// config.js; this runs their stages (goto, pickup, steal, kill, escape,
// race, deliver), the beacon marker, and the dialogue queue.
(function () {
  'use strict';
  const T = THREE;

  const M = { beacon: null, beaconRing: null, targetCar: null, raceIndex: 0 };

  function makeBeacon() {
    const g = new T.Group();
    const cyl = new T.Mesh(
      new T.CylinderGeometry(3.2, 3.2, 30, 16, 1, true),
      new T.MeshBasicMaterial({ color: 0xffd24c, transparent: true, opacity: 0.22, side: T.DoubleSide, depthWrite: false })
    );
    cyl.position.y = 15;
    g.add(cyl);
    const gem = new T.Mesh(
      new T.OctahedronGeometry(1.1),
      new T.MeshBasicMaterial({ color: 0xffd24c })
    );
    gem.position.y = 12;
    g.add(gem);
    const ring = new T.Mesh(
      new T.RingGeometry(2.6, 3.4, 24),
      new T.MeshBasicMaterial({ color: 0xffd24c, transparent: true, opacity: 0.7, side: T.DoubleSide, depthWrite: false })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.15;
    g.add(ring);
    g.visible = false;
    SB.view.scene.add(g);
    M.beacon = g;
    M.beaconGem = gem;
    M.beaconRing = ring;
  }

  function placeBeacon(x, z) {
    if (!M.beacon) makeBeacon();
    M.beacon.position.set(x, 0, z);
    M.beacon.visible = true;
  }

  function hideBeacon() { if (M.beacon) M.beacon.visible = false; }

  function say(charKey, text, seconds) {
    SB.state.dialogue = { char: charKey, text: text, until: performance.now() / 1000 + (seconds || 6) };
    SB.HUD.showDialogue();
  }

  function currentJob() { return SB.JOBS[SB.state.jobIndex]; }

  function startJob(index) {
    const job = SB.JOBS[index];
    if (!job) return false;
    SB.state.jobIndex = index;
    const mission = {
      job: job, stageIndex: 0, timer: 0, kills: 0,
      startedAt: performance.now() / 1000, failed: false
    };
    SB.state.mission = mission;
    SB.state.objective = job.stages[0].label;
    say(job.giver, job.intro, 8);
    enterStage(mission);
    return true;
  }

  function enterStage(mission) {
    const st = mission.job.stages[mission.stageIndex];
    if (!st) { completeJob(mission); return; }
    mission.timer = st.timeout || 0;
    SB.state.objective = st.label;
    if (st.type === 'goto' || st.type === 'pickup' || st.type === 'deliver') placeBeacon(st.x, st.z);
    else if (st.type === 'steal') {
      placeBeacon(st.x, st.z);
      // The target car: white Comet parked at the marker.
      M.targetCar = SB.makeCar({ kind: 'target', colour: 0xe8e8e8, x: st.x, z: st.z, heading: 0.4, cruise: 0 });
      M.targetCar.target = true;
    } else if (st.type === 'kill') {
      placeBeacon(st.x, st.z);
      SB.spawnEnemies(st.count, st.x, st.z, st.r, SB.rng);
      mission.kills = 0;
    } else if (st.type === 'race') {
      M.raceIndex = 0;
      placeBeacon(st.points[0].x, st.points[0].z);
    } else if (st.type === 'escape') {
      hideBeacon();
      if (SB.state.wanted < 3) SB.setWanted(3);
      SB.ensureUnits(SB.player.x, SB.player.z, SB.rng);
    }
  }

  function completeStage(mission) {
    mission.stageIndex += 1;
    SB.Audio.pickup();
    if (mission.stageIndex >= mission.job.stages.length) { completeJob(mission); return; }
    enterStage(mission);
  }

  function completeJob(mission) {
    const job = mission.job;
    SB.state.money += job.pay;
    SB.state.respect += 120;
    SB.state.respectLevel = 1 + Math.floor(SB.state.respect / 400);
    if (SB.state.jobsDone.indexOf(job.id) < 0) SB.state.jobsDone.push(job.id);
    SB.state.mission = null;
    SB.state.objective = '';
    hideBeacon();
    SB.clearEnemies();
    SB.Audio.missionDone();
    say(job.giver, job.outro + ' (+$' + job.pay + ')', 7);
    SB.saveGame();
  }

  function failJob(reason) {
    const mission = SB.state.mission;
    if (!mission) return;
    SB.state.mission = null;
    SB.state.objective = '';
    hideBeacon();
    SB.clearEnemies();
    if (M.targetCar) { SB.removeCar(M.targetCar); M.targetCar = null; }
    say(mission.job.giver, 'Job failed: ' + reason + ' Come back when you are ready.', 6);
  }

  SB.Missions = M;
  SB.say = say;
  SB.startJob = startJob;
  SB.completeStage = completeStage;
  SB.completeJob = completeJob;
  SB.failJob = failJob;
  SB.currentJob = currentJob;
  SB.placeBeacon = placeBeacon;
  SB.hideBeacon = hideBeacon;
})();

// Per-frame stage checks and mission events (kills, stolen cars, pickups).
(function () {
  'use strict';
  const M = SB.Missions;

  function update(dt) {
    const mission = SB.state.mission;
    // Beacon bob + spin.
    if (M.beacon && M.beacon.visible) {
      M.beaconGem.position.y = 12 + Math.sin(performance.now() / 300) * 0.8;
      M.beaconGem.rotation.y += dt * 2;
      M.beaconRing.rotation.z += dt * 0.8;
    }
    if (!mission) return;
    const st = mission.job.stages[mission.stageIndex];
    if (!st) return;
    const p = SB.player;
    if (!p) return;
    // Stage timeout (escape / race clocks).
    if (st.timeout) {
      mission.timer -= dt;
      if (mission.timer <= 0) {
        SB.failJob(st.type === 'escape' ? 'the window closed — the cops kept you' : 'out of time');
        return;
      }
    }
    if (st.type === 'goto' || st.type === 'deliver') {
      if (SB.dist2d(p.x, p.z, st.x, st.z) < st.r) SB.completeStage(mission);
    } else if (st.type === 'pickup') {
      if (SB.dist2d(p.x, p.z, st.x, st.z) < st.r && SB.Input.consumeInteract()) SB.completeStage(mission);
    } else if (st.type === 'steal') {
      // Completes when the player drives the target car (see onCarStolen).
      if (M.targetCar && SB.state.inCar && SB.vehicles.player === M.targetCar) {
        SB.completeStage(mission);
        M.targetCar = null;
      }
    } else if (st.type === 'kill') {
      if (mission.kills >= st.count) SB.completeStage(mission);
    } else if (st.type === 'escape') {
      if (SB.state.wanted <= 0) SB.completeStage(mission);
    } else if (st.type === 'race') {
      const pt = st.points[M.raceIndex];
      if (pt && SB.dist2d(p.x, p.z, pt.x, pt.z) < 10) {
        M.raceIndex += 1;
        SB.Audio.pickup();
        if (M.raceIndex >= st.points.length) SB.completeStage(mission);
        else {
          const next = st.points[M.raceIndex];
          SB.state.objective = next.label;
          SB.placeBeacon(next.x, next.z);
        }
      }
    }
  }

  function onKill() {
    const mission = SB.state.mission;
    if (!mission) return;
    mission.kills += 1;
    SB.state.kills += 1;
    const st = mission.job.stages[mission.stageIndex];
    if (st && st.type === 'kill') {
      SB.state.objective = st.label + ' — ' + mission.kills + '/' + st.count + ' down';
    }
  }

  // Called when the player enters any car. Returns true when it was the
  // mission target (a steal) or a traffic car (a theft crime).
  function onCarEntered(car) {
    if (!car) return 'own';
    if (car.target) return 'target';
    if (car.kind === 'traffic') { SB.addWanted(1, 'theft'); return 'stolen'; }
    if (car.kind === 'police') { SB.addWanted(2, 'police theft'); return 'stolen'; }
    return 'own';
  }

  // The job-start marker: a beacon at the current job's first stage, with E
  // to start. Shown when no mission is active.
  function jobStartPoint() {
    if (SB.state.mission) return null;
    const job = SB.currentJob();
    if (!job) return null;
    const st = job.stages[0];
    if (st.x === undefined) return null;
    return { x: st.x, z: st.z, job: job };
  }

  function updateJobStartBeacon() {
    const sp = jobStartPoint();
    if (!sp) { if (!SB.state.mission) SB.hideBeacon(); return; }
    SB.placeBeacon(sp.x, sp.z);
    SB.state.objective = 'Start job: ' + sp.job.name + ' (E)';
  }

  SB.Missions.update = update;
  SB.Missions.onKill = onKill;
  SB.Missions.onCarEntered = onCarEntered;
  SB.Missions.jobStartPoint = jobStartPoint;
  SB.Missions.updateJobStartBeacon = updateJobStartBeacon;
})();
