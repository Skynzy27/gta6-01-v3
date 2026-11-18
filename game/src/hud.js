// SPDX-License-Identifier: MIT
// Solmar Bay 3D — HUD: money, wanted stars, minimap, speed, radio, weapon
// slots, mission panel, police response list and dialogue box. All DOM;
// the 3D world stays in world.js. Portraits are drawn procedurally.
(function () {
  'use strict';

  const $ = function (id) { return document.getElementById(id); };
  const H = { minimap: null, mapCanvas: null, lastMinimap: 0 };

  function el(id) { return $(id); }

  // Blocky portrait: skin, hair style, extras (shades / cap / scar / tie).
  function drawPortrait(canvas, key) {
    const c = SB.CHARACTERS[key];
    if (!c || !canvas) return;
    const g = canvas.getContext('2d');
    const S = canvas.width;
    g.clearRect(0, 0, S, S);
    g.fillStyle = '#2a2438'; g.fillRect(0, 0, S, S);
    const u = S / 16;
    // Shoulders.
    g.fillStyle = '#3a3f4a'; g.fillRect(2 * u, 12 * u, 12 * u, 4 * u);
    // Head.
    g.fillStyle = c.skin; g.fillRect(5 * u, 3 * u, 6 * u, 6.5 * u);
    // Hair.
    g.fillStyle = c.hair;
    if (c.style === 'long') { g.fillRect(4.4 * u, 2 * u, 7.2 * u, 7 * u); g.fillStyle = c.skin; g.fillRect(5 * u, 3 * u, 6 * u, 6.5 * u); g.fillStyle = c.hair; g.fillRect(5 * u, 2 * u, 6 * u, 1.6 * u); }
    else if (c.style === 'bob') { g.fillRect(4.6 * u, 2 * u, 6.8 * u, 4 * u); }
    else if (c.style === 'cap') { g.fillRect(4.8 * u, 1.6 * u, 6.4 * u, 2.2 * u); g.fillRect(4.2 * u, 3.4 * u, 7.6 * u, 0.9 * u); }
    else if (c.style === 'slick') { g.fillRect(5 * u, 2.2 * u, 6 * u, 1.2 * u); }
    else { g.fillRect(5 * u, 2.2 * u, 6 * u, 1.4 * u); }
    // Eyes.
    g.fillStyle = '#1a1a1a';
    g.fillRect(6.2 * u, 5.4 * u, 1.1 * u, 1.1 * u);
    g.fillRect(8.7 * u, 5.4 * u, 1.1 * u, 1.1 * u);
    if (c.extra === 'shades') {
      g.fillStyle = '#111';
      g.fillRect(5.6 * u, 5 * u, 4.8 * u, 1.8 * u);
      g.fillStyle = '#9fd8ff'; g.fillRect(6 * u, 5.3 * u, 1.2 * u, 0.5 * u);
    }
    if (c.extra === 'scar') {
      g.strokeStyle = '#a04a3a'; g.lineWidth = 0.7 * u;
      g.beginPath(); g.moveTo(9.6 * u, 4 * u); g.lineTo(8.6 * u, 7 * u); g.stroke();
    }
    if (c.extra === 'tie') {
      g.fillStyle = '#c0392b'; g.fillRect(7.6 * u, 12 * u, 0.8 * u, 3 * u);
    }
    // Mouth.
    g.fillStyle = '#7a3a2a'; g.fillRect(7 * u, 7.6 * u, 2 * u, 0.5 * u);
  }

  function fmtMoney(n) { return '$' + Math.floor(n).toLocaleString('en-US'); }

  function starsHTML() {
    let out = '';
    for (let i = 0; i < 5; i += 1) out += '<span class="star' + (i < SB.state.wanted ? ' on' : '') + '">★</span>';
    return out;
  }

  function updateHUD() {
    const s = SB.state;
    const money = el('money'); if (money) money.textContent = fmtMoney(s.money);
    const clock = el('clock');
    if (clock) {
      const h = Math.floor(s.time), m = Math.floor((s.time - h) * 60);
      clock.textContent = 'DAY ' + s.day + '  ' + String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    }
    const stars = el('stars'); if (stars) stars.innerHTML = starsHTML();
    const sight = el('sight-badge');
    if (sight) {
      sight.style.display = s.wanted > 0 && s.spotted ? 'block' : 'none';
      sight.textContent = 'IN SIGHT';
    }
    const obj = el('mission-objective');
    if (obj) obj.textContent = s.objective || 'Free roam — open the map (M) to start a job';
    const ch = el('mission-chapter');
    if (ch) ch.textContent = s.mission ? s.mission.job.chapter + '  ' + s.mission.job.name : (SB.state.jobsDone.length ? 'FREE ROAM' : 'SOLMAR BAY');
    const spd = el('speed');
    if (spd) spd.textContent = String(Math.round(s.speedKmh));
    const radio = el('radio-station');
    if (radio) radio.textContent = '♪ ' + SB.Audio.stationName();
    const track = el('radio-track');
    if (track) track.textContent = SB.Audio.trackName();
    const dist = el('district-name');
    if (dist && SB.player) dist.textContent = SB.districtAt(SB.player.x, SB.player.z);
    // Weapon slots.
    for (let i = 0; i < 5; i += 1) {
      const slot = el('weapon-' + i);
      if (!slot) continue;
      const w = SB.WEAPONS[i];
      slot.classList.toggle('active', s.weapon === i);
      slot.classList.toggle('locked', w.name === 'LOCKED');
      const ammo = slot.querySelector('.ammo');
      if (ammo) ammo.textContent = w.name === 'LOCKED' ? '—' : (s.ammo[i] === Infinity ? '∞' : s.ammo[i] + '/' + s.mag[i]);
    }
    // Car panel.
    const carPanel = el('car-panel');
    if (carPanel) carPanel.style.display = s.inCar ? 'block' : 'none';
    const cond = el('car-condition');
    if (cond) cond.style.width = Math.max(0, s.carHealth) + '%';
    // Health / respect bars.
    const hb = el('health-bar'); if (hb) hb.style.width = Math.max(0, s.playerHealth) + '%';
    const rb = el('respect-bar'); if (rb) rb.style.width = ((s.respect % 400) / 4) + '%';
    const rl = el('respect-level'); if (rl) rl.textContent = 'RESPECT ' + s.respectLevel;
    // Mission timer.
    const timer = el('mission-timer');
    if (timer) {
      const m = s.mission;
      const st = m ? m.job.stages[m.stageIndex] : null;
      if (st && st.timeout) {
        const t = Math.max(0, m.timer);
        timer.style.display = 'block';
        timer.textContent = '◷ ' + Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
      } else timer.style.display = 'none';
    }
    updatePolicePanel();
    if (SB.HUD.drawMinimap) SB.HUD.drawMinimap();
  }

  function updatePolicePanel() {
    const panel = el('police-panel');
    if (!panel) return;
    const s = SB.state;
    if (s.wanted <= 0 || SB.vehicles.police.length === 0) { panel.style.display = 'none'; return; }
    panel.style.display = 'block';
    const list = el('police-units');
    const names = ['IBIS', 'TARPON', 'HERON', 'KESTREL', 'MARLIN', 'OSPREY'];
    let html = '';
    const units = SB.vehicles.police.slice(0, 5);
    units.forEach(function (c, i) {
      const d = Math.round(SB.dist2d(c.x, c.z, SB.player.x, SB.player.z));
      const status = c.roadblock ? 'ROADBLOCK' : (d < 14 ? 'RAMMING' : 'PURSUIT');
      html += '<div class="unit"><span>🚓 ' + names[i % names.length] + '-' + (43 + i * 7) + '</span><span>' + d + ' m</span><span class="tag">' + status + '</span></div>';
    });
    if (SB.vehicles.police.length > 5) html += '<div class="unit more">+' + (SB.vehicles.police.length - 5) + ' more units in the search zone</div>';
    list.innerHTML = html;
    const title = el('police-title');
    if (title) title.textContent = 'HKPD RESPONSE · ' + SB.vehicles.police.length + ' UNITS · CODE ' + s.wanted;
  }

  SB.HUD = SB.HUD || {};
  SB.HUD.drawPortrait = drawPortrait;
  SB.HUD.updateHUD = updateHUD;
  SB.HUD.fmtMoney = fmtMoney;
  SB.HUD.el = el;
})();

// Minimap, dialogue box, title screen, city map, pause and notices.
(function () {
  'use strict';
  const H = SB.HUD;
  const $ = H.el;

  function drawMinimap() {
    const c = $('minimap');
    if (!c || !SB.player) return;
    const now = performance.now();
    if (now - (H._lastMap || 0) < 120) return;
    H._lastMap = now;
    const g = c.getContext('2d');
    const S = c.width, R = 250;
    const toPx = function (v) { return (v + R) / (2 * R) * S; };
    g.clearRect(0, 0, S, S);
    // Sea + land.
    g.fillStyle = '#1f7d92'; g.fillRect(0, 0, S, S);
    g.fillStyle = '#5d6b52'; g.fillRect(toPx(-250), toPx(-250), toPx(250) - toPx(-250), toPx(250) - toPx(-250));
    // Roads.
    g.strokeStyle = '#2b2b33'; g.lineWidth = 3;
    SB.CFG.roads.forEach(function (r) {
      g.beginPath(); g.moveTo(toPx(-250), toPx(r)); g.lineTo(toPx(250), toPx(r)); g.stroke();
      g.beginPath(); g.moveTo(toPx(r), toPx(-250)); g.lineTo(toPx(r), toPx(250)); g.stroke();
    });
    // Mission beacon.
    const mission = SB.state.mission;
    const beacon = SB.Missions.beacon;
    if (beacon && beacon.visible) {
      g.fillStyle = '#ffd24c';
      g.beginPath();
      g.arc(toPx(beacon.position.x), toPx(beacon.position.z), 5, 0, Math.PI * 2);
      g.fill();
    }
    // Police blips.
    SB.vehicles.police.forEach(function (car) {
      g.fillStyle = '#4a90ff';
      g.beginPath(); g.arc(toPx(car.x), toPx(car.z), 3.5, 0, Math.PI * 2); g.fill();
    });
    if (SB.vehicles.heli) {
      g.fillStyle = '#ff5da2';
      g.beginPath(); g.arc(toPx(SB.vehicles.heli.x), toPx(SB.vehicles.heli.z), 4, 0, Math.PI * 2); g.fill();
    }
    // Player arrow (rotates with heading).
    g.save();
    g.translate(toPx(SB.player.x), toPx(SB.player.z));
    g.rotate(-SB.player.heading);
    g.fillStyle = '#ffffff';
    g.beginPath(); g.moveTo(7, 0); g.lineTo(-5, -5); g.lineTo(-5, 5); g.closePath(); g.fill();
    g.restore();
    // North tick.
    g.fillStyle = '#fff'; g.font = 'bold 11px Arial'; g.fillText('N', 6, 14);
  }

  function showDialogue() {
    const d = SB.state.dialogue;
    const box = $('dialogue');
    if (!box || !d) return;
    const c = SB.CHARACTERS[d.char];
    $('dialogue-name').textContent = c ? c.name : '';
    $('dialogue-role').textContent = c ? c.role : '';
    $('dialogue-text').textContent = d.text;
    H.drawPortrait($('dialogue-portrait'), d.char);
    box.style.display = 'flex';
  }

  function hideDialogue() {
    const box = $('dialogue');
    if (box) box.style.display = 'none';
  }

  function flashWanted() {
    const f = $('flash');
    if (!f) return;
    f.style.opacity = '0.5';
    setTimeout(function () { f.style.opacity = '0'; }, 180);
  }

  function notice(text, sub, ms) {
    const n = $('center-notice');
    if (!n) return;
    $('notice-title').textContent = text;
    $('notice-sub').textContent = sub || '';
    n.style.display = 'block';
    setTimeout(function () { n.style.display = 'none'; }, ms || 2600);
  }

  // Full city map overlay: districts, roads, markers, job list, legend.
  function drawMap() {
    const c = $('map-canvas');
    if (!c) return;
    const g = c.getContext('2d');
    const W = c.width, Hh = c.height, R = 250;
    // Square world map, centered in the 640x560 canvas (the old code mapped
    // z onto the full width, so the bottom districts fell off the canvas).
    const S = Math.min(W, Hh);
    const ox = (W - S) / 2, oy = (Hh - S) / 2;
    const toPx = function (v) { return ox + (v + R) / (2 * R) * S; };
    const toPy = function (v) { return oy + (v + R) / (2 * R) * S; };
    g.fillStyle = '#1f7d92'; g.fillRect(0, 0, W, Hh);
    // District washes.
    SB.DISTRICTS.forEach(function (d) {
      g.fillStyle = d.tint + '55';
      g.fillRect(toPx(d.x0), toPy(d.z0), toPx(d.x1) - toPx(d.x0), toPy(d.z1) - toPy(d.z0));
      g.fillStyle = '#e8e8e8'; g.font = 'bold 13px Arial'; g.textAlign = 'center';
      g.fillText(d.name, (toPx(d.x0) + toPx(d.x1)) / 2, (toPy(d.z0) + toPy(d.z1)) / 2);
    });
    // Roads.
    g.strokeStyle = '#e8e8e8'; g.lineWidth = 2;
    SB.CFG.roads.forEach(function (r) {
      g.beginPath(); g.moveTo(toPx(-250), toPy(r)); g.lineTo(toPx(250), toPy(r)); g.stroke();
      g.beginPath(); g.moveTo(toPx(r), toPy(-250)); g.lineTo(toPx(r), toPy(250)); g.stroke();
    });
    // Route to the objective.
    const mission = SB.state.mission;
    const beacon = SB.Missions.beacon;
    if (beacon && beacon.visible && SB.player) {
      g.strokeStyle = '#ffd24c'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(toPx(SB.player.x), toPy(SB.player.z)); g.lineTo(toPx(beacon.position.x), toPy(beacon.position.z)); g.stroke();
      g.fillStyle = '#ffd24c';
      g.beginPath(); g.arc(toPx(beacon.position.x), toPy(beacon.position.z), 8, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#111'; g.font = 'bold 11px Arial'; g.textAlign = 'center';
      const d = Math.round(SB.dist2d(SB.player.x, SB.player.z, beacon.position.x, beacon.position.z));
      g.fillText(d + ' m', toPx(beacon.position.x), toPy(beacon.position.z) - 12);
    }
    // Player.
    if (SB.player) {
      g.save();
      g.translate(toPx(SB.player.x), toPy(SB.player.z));
      g.rotate(-SB.player.heading);
      g.fillStyle = '#fff';
      g.beginPath(); g.moveTo(10, 0); g.lineTo(-7, -7); g.lineTo(-7, 7); g.closePath(); g.fill();
      g.restore();
    }
    g.textAlign = 'left';
  }

  function renderJobList() {
    const list = $('map-jobs');
    if (!list) return;
    let html = '';
    SB.JOBS.forEach(function (job, i) {
      const done = SB.state.jobsDone.indexOf(job.id) >= 0;
      const current = SB.state.mission && SB.state.mission.job.id === job.id;
      const locked = i > 0 && SB.state.jobsDone.indexOf(SB.JOBS[i - 1].id) < 0 && !current && !done;
      const status = done ? 'Complete' : current ? 'In progress' : locked ? 'Locked' : 'Available';
      html += '<div class="job' + (current ? ' current' : '') + (locked ? ' locked' : '') + '">'
        + '<span class="job-num">' + (i + 1) + '. ' + job.name + '</span>'
        + '<span class="job-pay">$' + job.pay.toLocaleString('en-US') + '</span>'
        + '<span class="job-status">' + status + '</span></div>';
    });
    list.innerHTML = html;
    const stats = $('map-stats');
    if (stats) {
      stats.innerHTML = 'Cash ' + H.fmtMoney(SB.state.money)
        + '<br>Respect level ' + SB.state.respectLevel
        + '<br>Sunset Tapes ' + SB.state.tapes + ' / 20'
        + '<br>Properties ' + SB.state.properties + ' / 2';
    }
  }

  H.drawMinimap = drawMinimap;
  H.showDialogue = showDialogue;
  H.hideDialogue = hideDialogue;
  H.flashWanted = flashWanted;
  H.notice = notice;
  H.drawMap = drawMap;
  H.renderJobList = renderJobList;
})();
