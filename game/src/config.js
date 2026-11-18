// SPDX-License-Identifier: MIT
// Solmar Bay 3D — shared config: constants, seeded random, districts, story
// jobs, characters, radio stations and weapons. Every module reads SB.
window.SB = window.SB || {};
(function () {
  'use strict';

  // Seeded random (mulberry32) so ?seed= replays the same city.
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashSeed(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i += 1) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  const CFG = {
    title: 'Solmar Bay 3D',
    worldHalf: 250,            // playable city half-size (units)
    roadStep: 60,              // distance between road centre lines
    roadWidth: 14,
    roads: [-180, -120, -60, 0, 60, 120, 180],
    blockCentres: [-150, -90, -30, 30, 90, 150],
    gravity: 0,
    playerWalkSpeed: 9,
    playerSprintSpeed: 15,
    carTopSpeed: 62,           // units/s (~150 km/h display)
    carAccel: 26,
    carBrake: 46,
    carReverseTop: 18,
    wantedMax: 5,
    saveKey: 'solmarbay3d-save-v1',
    colours: {
      skySunset: 0x2e1b4d, skyTop: 0x3a2060, fogSunset: 0xd98a6a,
      skyNight: 0x0b1026, fogNight: 0x141a33,
      sun: 0xffb347, water: 0x2e8f9e, sand: 0xe8c98a,
      asphalt: 0x2b2b33, sidewalk: 0x9a938a,
      playerCar: 0xff2e88, policeCar: 0xf2f2f2, policeTrim: 0x11131a,
      taxi: 0xffc21c, heli: 0x22242e
    }
  };

  // Island districts, read by the map screen, minimap and HUD.
  const DISTRICTS = [
    { name: 'PALMETTO HEIGHTS', x0: -250, z0: -250, x1: 250, z1: -120, tint: '#7fae62' },
    { name: 'NEON MILE', x0: -120, z0: -120, x1: 60, z1: 0, tint: '#ff5da2' },
    { name: 'OLD MERCADO', x0: -250, z0: 0, x1: -60, z1: 120, tint: '#e8b64c' },
    { name: 'CORAL STRAND', x0: 120, z0: -120, x1: 250, z1: 60, tint: '#ff8a5c' },
    { name: 'DECO ROW', x0: 60, z0: 0, x1: 250, z1: 120, tint: '#5cd6d6' },
    { name: 'BAYLINE DOCKS', x0: -250, z0: 120, x1: 60, z1: 250, tint: '#8a7fd6' },
    { name: 'PELICAN MARINA', x0: 60, z0: 120, x1: 250, z1: 250, tint: '#4c9be8' },
    { name: 'KEYSTONE FIELD', x0: -250, z0: -250, x1: -120, z1: -120, tint: '#9aa58a' }
  ];

  function districtAt(x, z) {
    for (let i = 0; i < DISTRICTS.length; i += 1) {
      const d = DISTRICTS[i];
      if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d.name;
    }
    return 'SOLMAR BAY';
  }

  // Story characters. Portraits are drawn procedurally by hud.js.
  const CHARACTERS = {
    dez:   { name: 'DEZ CALLOWAY', role: 'DRIVER', skin: '#c98d5f', hair: '#2b2b2b', style: 'flat', extra: 'none' },
    pearl: { name: 'PEARL VOSS', role: 'FIXER', skin: '#e8b88a', hair: '#e8e8e8', style: 'bob', extra: 'shades' },
    juno:  { name: 'JUNO REYES', role: 'WHEELWOMAN', skin: '#8a5a3b', hair: '#ff2e88', style: 'long', extra: 'shades' },
    mags:  { name: 'MAGS ORTIZ', role: 'MECHANIC', skin: '#a06a42', hair: '#3a2a1a', style: 'cap', extra: 'cap' },
    ben:   { name: 'BENNING COLE', role: 'DETECTIVE', skin: '#d9a06a', hair: '#5a4a3a', style: 'flat', extra: 'tie' },
    silas: { name: 'SILAS GRIEVE', role: 'UNDERTOW BOSS', skin: '#e8c39a', hair: '#d8d8d8', style: 'slick', extra: 'scar' }
  };

  // Weapons: fists, pistol, SMG. Slots 0-2 usable, 3-4 locked (shown).
  const WEAPONS = [
    { name: 'FISTS', slot: 0, damage: 12, rate: 0.45, ammo: Infinity, mag: Infinity, range: 3.2, auto: false },
    { name: 'PISTOL', slot: 1, damage: 34, rate: 0.28, ammo: 60, mag: 12, range: 60, auto: false },
    { name: 'WASP SMG', slot: 2, damage: 16, rate: 0.09, ammo: 160, mag: 32, range: 55, auto: true },
    { name: 'LOCKED', slot: 3, damage: 0, rate: 1, ammo: 0, mag: 0, range: 0, auto: false },
    { name: 'LOCKED', slot: 4, damage: 0, rate: 1, ammo: 0, mag: 0, range: 0, auto: false }
  ];

  // Radio stations: step-sequencer patterns (16 steps, note = semitone offset).
  const STATIONS = [
    { name: 'WAVE 88.1', desc: 'Neon Drive', artist: 'Pink Horizon — Lumen Kids', bpm: 112,
      bass: [0, 0, 7, 0, 10, 0, 7, 5, 0, 0, 7, 0, 12, 10, 7, 5],
      lead: [12, 0, 15, 19, 0, 15, 12, 0, 14, 0, 17, 15, 12, 0, 10, 0] },
    { name: 'SOL 92.4', desc: 'Bay Funk', artist: 'The Marlin Club — Coastline', bpm: 98,
      bass: [0, 3, 0, 5, 0, 3, 7, 0, 0, 3, 0, 5, 8, 7, 5, 3],
      lead: [12, 12, 0, 10, 0, 12, 0, 15, 14, 12, 0, 10, 0, 7, 0, 12] },
    { name: 'NIGHT 104.7', desc: 'After Dark', artist: 'Vesper — Midnight Run', bpm: 124,
      bass: [0, 0, 0, 7, 0, 0, 5, 0, 0, 0, 3, 0, 5, 0, 7, 10],
      lead: [0, 15, 0, 12, 0, 19, 17, 15, 0, 12, 0, 14, 15, 0, 12, 0] }
  ];

  // Fresh run state (save/load overlays the persistent bits).
  function freshState() {
    return {
      mode: 'title',            // title | play | paused | map | dead | busted
      pausedFrom: 'play',
      time: 18.9,               // hours; 18.9 = sunset, 21.7 = night
      night: false,
      day: 1,
      money: 350,
      respect: 0,
      respectLevel: 1,
      wanted: 0,
      heat: 0,
      spotted: false,
      hiddenTimer: 0,
      bustedTimer: 0,
      cameraMode: 'chase',      // chase | classic
      radio: 0,
      muted: false,
      jobIndex: 0,
      jobsDone: [],
      mission: null,            // active mission runtime
      dialogue: null,           // {char, text, until}
      objective: '',
      speedKmh: 0,
      inCar: false,
      carHealth: 100,
      playerHealth: 100,
      weapon: 0,
      ammo: [Infinity, 60, 160, 0, 0],
      mag: [Infinity, 12, 32, 0, 0],
      kills: 0,
      tapes: 0,
      properties: 0,
      shot: null,
      seed: 1
    };
  }

  SB.CFG = CFG;
  SB.DISTRICTS = DISTRICTS;
  SB.districtAt = districtAt;
  SB.CHARACTERS = CHARACTERS;
  SB.WEAPONS = WEAPONS;
  SB.STATIONS = STATIONS;
  SB.mulberry32 = mulberry32;
  SB.hashSeed = hashSeed;
  SB.freshState = freshState;
  SB.state = freshState();
  SB.rng = mulberry32(1);
  SB.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  SB.lerp = function (a, b, t) { return a + (b - a) * t; };
  SB.dist2d = function (ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return Math.sqrt(dx * dx + dz * dz); };
  SB.angleLerp = function (a, b, t) {
    let d = (b - a) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return a + d * t;
  };
})();

// Story jobs. Stages drive the mission engine in missions.js:
// goto {x,z,r,label} · pickup {x,z,r,label} · steal {x,z,r,label,car}
// kill {count,x,z,r,label} · escape {label,timeout} · race {points[],timeout}
// deliver {x,z,r,label}. All coordinates are world units.
(function () {
  'use strict';
  const JOBS = [
    {
      id: 'low-tide', name: 'LOW TIDE', chapter: 'CH 1', pay: 1500, giver: 'dez',
      intro: 'Dez is back in Solmar Bay — and the Undertow owns the tide. First job: easy. Grab the package at the docks, bring it to the marina. No heroes.',
      outro: 'Clean run. The marina boys pay on time when Dez vouches for you.',
      stages: [
        { type: 'goto', x: -210, z: 195, r: 8, label: 'Go to Bayline Docks' },
        { type: 'pickup', x: -210, z: 195, r: 6, label: 'Pick up the package (E)' },
        { type: 'deliver', x: 195, z: 210, r: 8, label: 'Deliver to Pelican Marina' }
      ]
    },
    {
      id: 'cold-cargo', name: 'COLD CARGO', chapter: 'CH 2', pay: 3200, giver: 'pearl',
      intro: 'Pearl needs a Comet, white, no questions. It is parked up in Palmetto Heights. Take it. Bring it to Mags. Try not to scratch it.',
      outro: 'Pearl pays, Mags winks, the Comet vanishes into a container. Business.',
      stages: [
        { type: 'steal', x: -150, z: -150, r: 10, label: 'Steal the white Comet (F)' },
        { type: 'deliver', x: -30, z: -90, r: 8, label: 'Bring it to Mags\' garage' }
      ]
    },
    {
      id: 'undertow', name: 'UNDERTOW', chapter: 'CH 3', pay: 4200, giver: 'juno',
      intro: 'The Undertow crew runs Neon Mile after dark. Silas sent boys to watch the club. Take out 6 of them. Juno will be listening on the radio.',
      outro: 'Six down. The club lights stay on tonight. Juno owes you one.',
      stages: [
        { type: 'goto', x: -60, z: -60, r: 10, label: 'Get to Club Voltage' },
        { type: 'kill', count: 6, x: -60, z: -60, r: 26, label: 'Take out the Undertow crew' }
      ]
    },
    {
      id: 'blue-lights', name: 'BLUE LIGHTS', chapter: 'CH 4', pay: 5000, giver: 'ben',
      intro: 'Benning here. Off the record: the department is sweeping the Mile tonight and you are on their list. Lose them. All of them. The helicopter too.',
      outro: 'You vanished. Benning will deny this call ever happened.',
      stages: [
        { type: 'escape', label: 'Lose the cops — break line of sight' }
      ]
    },
    {
      id: 'paper-moon', name: 'PAPER MOON', chapter: 'CH 5', pay: 6500, giver: 'juno',
      intro: 'Juno\'s scanner window closes in two minutes. Lose the cops before it does — they can see you, so break line of sight. Then bring the money home.',
      outro: 'Money\'s home. Juno says the scanner never saw a thing.',
      stages: [
        { type: 'escape', label: 'Lose the cops before the window closes', timeout: 126 },
        { type: 'deliver', x: 30, z: 30, r: 8, label: 'Bring the money home' }
      ]
    },
    {
      id: 'causeway-run', name: 'CAUSEWAY RUN', chapter: 'CH 6', pay: 4800, giver: 'mags',
      intro: 'Mags built you a runner. Five checkpoints, Coral Strand to Keystone Field, against the clock. Beat 2:30 and the street talks about you.',
      outro: '2:30 beaten. Your name is spray-painted on the causeway by morning.',
      stages: [
        { type: 'race', timeout: 150, points: [
          { x: 180, z: -60, label: 'Checkpoint 1' },
          { x: 180, z: 120, label: 'Checkpoint 2' },
          { x: 0, z: 180, label: 'Checkpoint 3' },
          { x: -180, z: 60, label: 'Checkpoint 4' },
          { x: -180, z: -180, label: 'Finish' }
        ] }
      ]
    },
    {
      id: 'last-light', name: 'LAST LIGHT', chapter: 'CH 7', pay: 9000, giver: 'silas',
      intro: 'Silas Grieve himself. The estate on Grieve Isle, four guards, one ledger. Take the ledger, then disappear before the whole island wakes up.',
      outro: 'Ledger in hand, island behind you. Solmar Bay is yours now.',
      stages: [
        { type: 'goto', x: 210, z: -150, r: 10, label: 'Reach Grieve Estate' },
        { type: 'kill', count: 4, x: 210, z: -150, r: 24, label: 'Take out the estate guards' },
        { type: 'pickup', x: 210, z: -150, r: 6, label: 'Take the ledger (E)' },
        { type: 'escape', label: 'Disappear — lose all heat' }
      ]
    }
  ];
  SB.JOBS = JOBS;
})();
