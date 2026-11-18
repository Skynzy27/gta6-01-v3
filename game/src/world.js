// SPDX-License-Identifier: MIT
// Solmar Bay 3D — world: the Three.js scene. Sunset island city built from
// boxes: ground with a painted road grid, towers with lit windows, palms,
// neon signs, marina and docks. All textures are drawn on canvas at runtime.
(function () {
  'use strict';

  const T = THREE;
  const view = { renderer: null, scene: null, camera: null, sun: null, moon: null, sunGlow: null, hemi: null, dirLight: null };
  const city = { colliders: [], buildings: [], palms: [], signs: [], boats: [], roadLines: [] };

  function canvasTexture(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const tex = new T.CanvasTexture(c);
    tex.anisotropy = 4;
    return tex;
  }

  // Ground: one 1024 canvas maps world [-280, 280] to pixels. Roads, blocks,
  // sidewalks, crosswalks, sand and water are all painted here.
  function groundTexture(rng) {
    return canvasTexture(1024, 1024, function (g) {
      const toPx = function (v) { return (v + 280) / 560 * 1024; };
      // Base: dry grass / dirt.
      g.fillStyle = '#6d7a52'; g.fillRect(0, 0, 1024, 1024);
      // Water ring around the island.
      g.fillStyle = '#1f7d92'; g.fillRect(0, 0, 1024, 1024);
      // Sand ring.
      g.fillStyle = '#e8c98a';
      g.fillRect(toPx(-252), toPx(-252), toPx(252) - toPx(-252), toPx(252) - toPx(-252));
      // City ground.
      g.fillStyle = '#8a8f7a'; g.fillRect(toPx(-250), toPx(-250), 500 / 560 * 1024, 500 / 560 * 1024);
      // Blocks.
      const roads = SB.CFG.roads;
      for (let i = 0; i < roads.length - 1; i += 1) {
        for (let j = 0; j < roads.length - 1; j += 1) {
          const x0 = toPx(roads[i] + 7), z0 = toPx(roads[j] + 7);
          const s = (roads[i + 1] - roads[i] - 14) / 560 * 1024;
          g.fillStyle = rng() < 0.5 ? '#7d7f72' : '#86887a';
          g.fillRect(x0, z0, s, s);
          // Sidewalk border.
          g.strokeStyle = '#a9a294'; g.lineWidth = 3;
          g.strokeRect(x0, z0, s, s);
        }
      }
      // Roads (asphalt) with centre dashes.
      g.fillStyle = '#2b2b33';
      roads.forEach(function (r) {
        g.fillRect(toPx(-250), toPx(r - 7), 500 / 560 * 1024, 14 / 560 * 1024);
        g.fillRect(toPx(r - 7), toPx(-250), 14 / 560 * 1024, 500 / 560 * 1024);
      });
      g.fillStyle = '#e8c84c';
      roads.forEach(function (r) {
        for (let v = -240; v < 240; v += 24) {
          g.fillRect(toPx(v), toPx(r - 1), 12 / 560 * 1024, 2);
          g.fillRect(toPx(r - 1), toPx(v), 2, 12 / 560 * 1024);
        }
      });
      // Crosswalks at intersections.
      g.fillStyle = '#e8e8e8';
      roads.forEach(function (rx) {
        roads.forEach(function (rz) {
          for (let k = -2; k <= 2; k += 1) {
            g.fillRect(toPx(rx + k * 3 - 1), toPx(rz - 7), 2, 14 / 560 * 1024);
            g.fillRect(toPx(rx - 7), toPx(rz + k * 3 - 1), 14 / 560 * 1024, 2);
          }
        });
      });
      // Beach strip (south) and marina water (east).
      g.fillStyle = '#efd9a0';
      g.fillRect(toPx(-250), toPx(210), 500 / 560 * 1024, 40 / 560 * 1024);
      g.fillStyle = '#2a93a8';
      g.fillRect(toPx(210), toPx(-250), 40 / 560 * 1024, 500 / 560 * 1024);
    });
  }

  // Lit-window facade, tinted per building by material colour.
  function windowsTexture(rng) {
    return canvasTexture(128, 256, function (g) {
      g.fillStyle = '#3a3f4a'; g.fillRect(0, 0, 128, 256);
      for (let y = 8; y < 248; y += 16) {
        for (let x = 8; x < 120; x += 14) {
          const lit = rng();
          g.fillStyle = lit < 0.45 ? '#ffd27a' : lit < 0.6 ? '#9fd8ff' : '#232833';
          g.fillRect(x, y, 9, 11);
        }
      }
    });
  }

  function neonTexture(text, colour) {
    return canvasTexture(512, 128, function (g) {
      g.clearRect(0, 0, 512, 128);
      g.font = 'bold 64px Arial, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = colour; g.shadowBlur = 26;
      g.fillStyle = colour;
      g.fillText(text, 256, 64);
      g.shadowBlur = 8;
      g.fillStyle = '#ffffff';
      g.fillText(text, 256, 64);
    });
  }

  function buildSky(scene, rng) {
    // Gradient dome: deep purple overhead to orange-pink horizon.
    const skyTex = canvasTexture(4, 256, function (g) {
      const gr = g.createLinearGradient(0, 0, 0, 256);
      gr.addColorStop(0, '#241536');
      gr.addColorStop(0.45, '#6b2d5e');
      gr.addColorStop(0.75, '#e2607a');
      gr.addColorStop(1, '#ff9a5c');
      g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
    });
    const dome = new T.Mesh(
      new T.SphereGeometry(900, 24, 16),
      new T.MeshBasicMaterial({ map: skyTex, side: T.BackSide, fog: false })
    );
    scene.add(dome);
    // Low sun disc + glow.
    const sun = new T.Mesh(
      new T.CircleGeometry(46, 32),
      new T.MeshBasicMaterial({ color: 0xffc46b, fog: false })
    );
    sun.position.set(-620, 95, -260);
    sun.lookAt(0, 40, 0);
    scene.add(sun);
    const glowTex = canvasTexture(128, 128, function (g) {
      const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,180,90,0.85)');
      gr.addColorStop(0.5, 'rgba(255,120,80,0.28)');
      gr.addColorStop(1, 'rgba(255,120,80,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    });
    const glow = new T.Mesh(
      new T.PlaneGeometry(420, 420),
      new T.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, fog: false })
    );
    glow.position.copy(sun.position);
    glow.lookAt(0, 40, 0);
    scene.add(glow);
    // Pale moon for the night preset (hidden by day).
    const moon = new T.Mesh(
      new T.CircleGeometry(26, 32),
      new T.MeshBasicMaterial({ color: 0xdde6ff, fog: false })
    );
    moon.position.set(420, 320, -420);
    moon.lookAt(0, 0, 0);
    moon.visible = false;
    scene.add(moon);
    view.sun = sun; view.sunGlow = glow; view.moon = moon;
  }

  function buildGround(scene, rng) {
    const ground = new T.Mesh(
      new T.PlaneGeometry(560, 560),
      new T.MeshLambertMaterial({ map: groundTexture(rng) })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, 0);
    scene.add(ground);
    // Open sea beyond the island.
    const sea = new T.Mesh(
      new T.PlaneGeometry(2400, 2400),
      new T.MeshLambertMaterial({ color: 0x1d6f88 })
    );
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(0, -0.6, 0);
    scene.add(sea);
  }

  function addCollider(x0, z0, x1, z1) {
    city.colliders.push({ x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1) });
  }

  // Circle (player / car) vs building boxes: push out, report hit.
  function collideCircle(x, z, r) {
    let hit = false;
    for (let i = 0; i < city.colliders.length; i += 1) {
      const b = city.colliders[i];
      if (x + r <= b.x0 || x - r >= b.x1 || z + r <= b.z0 || z - r >= b.z1) continue;
      const dxl = x + r - b.x0, dxr = b.x1 - (x - r);
      const dzl = z + r - b.z0, dzr = b.z1 - (z - r);
      const m = Math.min(dxl, dxr, dzl, dzr);
      if (m === dxl) x = b.x0 - r; else if (m === dxr) x = b.x1 + r;
      else if (m === dzl) z = b.z0 - r; else z = b.z1 + r;
      hit = true;
    }
    return { x: x, z: z, hit: hit };
  }

  SB.view = view;
  SB.city = city;
  SB.buildSky = buildSky;
  SB.buildGround = buildGround;
  SB.addCollider = addCollider;
  SB.collideCircle = collideCircle;
  SB.canvasTexture = canvasTexture;
  SB.neonTexture = neonTexture;
  SB.windowsTexture = windowsTexture;
})();

// Buildings, palms, neon, streetlights and props. One city build from a seed.
(function () {
  'use strict';
  const T = THREE;
  const SIGNS = [
    { text: 'CLUB VOLTAGE', colour: '#ff5da2', x: -60, z: -68, ry: 0 },
    { text: 'FLAMINGO FM', colour: '#ffb347', x: 60, z: -68, ry: 0 },
    { text: 'HOTEL CORALIE', colour: '#5cd6d6', x: 150, z: 30, ry: -Math.PI / 2 },
    { text: 'PIER 9', colour: '#9fd8ff', x: 210, z: 180, ry: -Math.PI / 2 },
    { text: 'CASINO SOLMAR', colour: '#ffd27a', x: -30, z: 60, ry: Math.PI },
    { text: 'SUNSET TAPES', colour: '#ff8a5c', x: 90, z: -120, ry: 0 },
    { text: 'TACOS', colour: '#7CFC66', x: -120, z: 30, ry: Math.PI / 2 }
  ];

  function buildBuildings(scene, rng) {
    const winTex = SB.windowsTexture(rng);
    const palette = [0x8a7f8d, 0x6f7f95, 0x9a8a7a, 0x7a6a8a, 0x5d6b7a, 0xb08a6a];
    const centres = SB.CFG.blockCentres;
    for (let ix = 0; ix < centres.length; ix += 1) {
      for (let iz = 0; iz < centres.length; iz += 1) {
        const cx = centres[ix], cz = centres[iz];
        const roll = rng();
        // Parks, parking lots and plazas break up the towers.
        if (roll < 0.14) { buildPark(scene, rng, cx, cz); continue; }
        if (roll < 0.24) { buildParking(scene, rng, cx, cz); continue; }
        const towers = 1 + Math.floor(rng() * 2);
        for (let t = 0; t < towers; t += 1) {
          const w = 16 + rng() * 14, d = 16 + rng() * 14;
          const h = 10 + rng() * rng() * 34;
          const ox = (rng() - 0.5) * 14, oz = (rng() - 0.5) * 14;
          const mat = new T.MeshLambertMaterial({
            map: winTex, color: palette[Math.floor(rng() * palette.length)],
            emissive: 0x222222, emissiveMap: winTex, emissiveIntensity: 0.55
          });
          const b = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
          b.position.set(cx + ox, h / 2, cz + oz);
          scene.add(b);
          SB.city.buildings.push(b);
          SB.addCollider(cx + ox - w / 2, cz + oz - d / 2, cx + ox + w / 2, cz + oz + d / 2);
          if (h > 26) {
            const roof = new T.Mesh(new T.BoxGeometry(4, 2.4, 4), new T.MeshLambertMaterial({ color: 0x3a3f4a }));
            roof.position.set(cx + ox, h + 1.2, cz + oz);
            scene.add(roof);
          }
        }
      }
    }
  }

  function buildPark(scene, rng, cx, cz) {
    for (let i = 0; i < 5; i += 1) {
      buildPalm(scene, cx + (rng() - 0.5) * 34, cz + (rng() - 0.5) * 34, rng);
    }
    const bench = new T.Mesh(new T.BoxGeometry(4, 1, 1.4), new T.MeshLambertMaterial({ color: 0x7a5a3a }));
    bench.position.set(cx, 0.8, cz + 6);
    scene.add(bench);
  }

  function buildParking(scene, rng, cx, cz) {
    // Flat lot: parked cars are added by vehicles.js from these spots.
    SB.city.parkingSpots = SB.city.parkingSpots || [];
    for (let i = 0; i < 4; i += 1) {
      SB.city.parkingSpots.push({ x: cx - 12 + i * 8, z: cz, heading: 0 });
    }
  }

  function buildPalm(scene, x, z, rng) {
    const trunk = new T.Mesh(
      new T.CylinderGeometry(0.35, 0.55, 7 + rng() * 3, 6),
      new T.MeshLambertMaterial({ color: 0x8a6a42 })
    );
    trunk.position.set(x, 4, z);
    trunk.rotation.z = (rng() - 0.5) * 0.16;
    scene.add(trunk);
    const crown = new T.Mesh(
      new T.ConeGeometry(3.4, 2.6, 7),
      new T.MeshLambertMaterial({ color: 0x3f8f3a })
    );
    crown.position.set(x + trunk.rotation.z * -4, 8.4, z);
    crown.scale.y = 0.55;
    scene.add(crown);
    SB.city.palms.push(trunk);
  }

  function buildPalms(scene, rng) {
    // Beach row + boulevard row.
    for (let x = -210; x <= 210; x += 30) {
      if (rng() < 0.8) buildPalm(scene, x + (rng() - 0.5) * 8, 218 + (rng() - 0.5) * 6, rng);
    }
    for (let z = -180; z <= 120; z += 40) {
      if (rng() < 0.6) buildPalm(scene, -186 + (rng() - 0.5) * 4, z, rng);
      if (rng() < 0.6) buildPalm(scene, 186 + (rng() - 0.5) * 4, z, rng);
    }
    for (let i = 0; i < 8; i += 1) {
      buildPalm(scene, -150 + rng() * 300, -150 + rng() * 60, rng);
    }
    // Palms along the two main boulevards (sidewalk strips, clear of buildings).
    for (let v = -210; v <= 210; v += 42) {
      if (rng() < 0.75) buildPalm(scene, v, -10, rng);
      if (rng() < 0.75) buildPalm(scene, v, 10, rng);
      if (rng() < 0.75) buildPalm(scene, -10, v, rng);
      if (rng() < 0.75) buildPalm(scene, 10, v, rng);
    }
  }

  function buildSigns(scene) {
    SIGNS.forEach(function (s) {
      const tex = SB.neonTexture(s.text, s.colour);
      const m = new T.Mesh(
        new T.PlaneGeometry(26, 6.5),
        new T.MeshBasicMaterial({ map: tex, transparent: true, side: T.DoubleSide })
      );
      m.position.set(s.x, 9, s.z);
      m.rotation.y = s.ry;
      scene.add(m);
      SB.city.signs.push(m);
    });
  }

  function buildStreetlights(scene) {
    const poleMat = new T.MeshLambertMaterial({ color: 0x2a2d33 });
    const headMat = new T.MeshBasicMaterial({ color: 0xffe9a8 });
    SB.CFG.roads.forEach(function (rx) {
      SB.CFG.roads.forEach(function (rz) {
        if ((rx + rz) % 120 !== 0) return;
        const pole = new T.Mesh(new T.CylinderGeometry(0.18, 0.22, 7, 6), poleMat);
        pole.position.set(rx + 8, 3.5, rz + 8);
        scene.add(pole);
        const head = new T.Mesh(new T.SphereGeometry(0.55, 8, 6), headMat);
        head.position.set(rx + 8, 7.1, rz + 8);
        scene.add(head);
      });
    });
  }

  function buildMarina(scene, rng) {
    // Docks + boats on the east water, containers at the south docks.
    for (let i = 0; i < 4; i += 1) {
      const dock = new T.Mesh(new T.BoxGeometry(4, 1, 26), new T.MeshLambertMaterial({ color: 0x8a6a4a }));
      dock.position.set(224 + i * 12, 0.5, 150 + i * 14);
      scene.add(dock);
      const hull = new T.Mesh(new T.BoxGeometry(3.4, 1.6, 9), new T.MeshLambertMaterial({ color: [0xe8e8e8, 0xff5da2, 0x5cd6d6, 0xffc21c][i] }));
      hull.position.set(230 + i * 12, 0.8, 150 + i * 14);
      scene.add(hull);
      const cab = new T.Mesh(new T.BoxGeometry(2.4, 1.4, 3), new T.MeshLambertMaterial({ color: 0x2a2d33 }));
      cab.position.set(230 + i * 12, 2.2, 150 + i * 14);
      scene.add(cab);
      SB.city.boats.push(hull);
    }
    const cols = [0xd65a4a, 0x4a7fd6, 0x4ad67a, 0xd6b84a];
    for (let i = 0; i < 8; i += 1) {
      const c = new T.Mesh(new T.BoxGeometry(9, 3, 3), new T.MeshLambertMaterial({ color: cols[i % 4] }));
      c.position.set(-210 + (i % 4) * 12, 1.5, 196 + Math.floor(i / 4) * 5);
      c.rotation.y = (rng() - 0.5) * 0.2;
      scene.add(c);
      SB.addCollider(c.position.x - 4.5, c.position.z - 1.6, c.position.x + 4.5, c.position.z + 1.6);
    }
    for (let i = 0; i < 10; i += 1) {
      const crate = new T.Mesh(new T.BoxGeometry(2.2, 2.2, 2.2), new T.MeshLambertMaterial({ color: 0xa88a5a }));
      crate.position.set(-200 + rng() * 60, 1.1, 180 + rng() * 24);
      crate.rotation.y = rng() * Math.PI;
      scene.add(crate);
      SB.addCollider(crate.position.x - 1.2, crate.position.z - 1.2, crate.position.x + 1.2, crate.position.z + 1.2);
    }
  }

  function buildWorld() {
    const scene = new T.Scene();
    scene.fog = new T.Fog(0xd98a6a, 130, 620);
    const camera = new T.PerspectiveCamera(62, 1280 / 720, 0.1, 2000);
    camera.position.set(0, 8, 24);
    const renderer = new T.WebGLRenderer({ canvas: document.getElementById('game'), antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
    const hemi = new T.HemisphereLight(0xffb38a, 0x2a2438, 0.7);
    scene.add(hemi);
    const dir = new T.DirectionalLight(0xff9a5c, 0.95);
    dir.position.set(-180, 120, -80);
    scene.add(dir);
    // Fill from the camera side so sunset-shadowed faces (car rears, east
    // building faces) still read instead of going black.
    const fill = new T.DirectionalLight(0xff9db8, 0.35);
    fill.position.set(180, 60, 60);
    scene.add(fill);
    SB.view.scene = scene; SB.view.camera = camera; SB.view.renderer = renderer;
    SB.view.hemi = hemi; SB.view.dirLight = dir; SB.view.fillLight = fill;
    const rng = SB.rng;
    SB.buildSky(scene, rng);
    SB.buildGround(scene, rng);
    buildBuildings(scene, rng);
    buildPalms(scene, rng);
    buildSigns(scene);
    buildStreetlights(scene);
    buildMarina(scene, rng);
    setTimeOfDay(false);
    window.addEventListener('resize', function () {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  function setTimeOfDay(night) {
    SB.state.night = night;
    const scene = SB.view.scene;
    if (!scene) return;
    if (night) {
      scene.fog.color.setHex(0x141a33);
      scene.background = null;
      SB.view.hemi.intensity = 0.32;
      SB.view.hemi.color.setHex(0x8a9ad6);
      SB.view.dirLight.intensity = 0.25;
      SB.view.dirLight.color.setHex(0x9ab0ff);
      if (SB.view.fillLight) SB.view.fillLight.intensity = 0.12;
      SB.view.sun.visible = false;
      SB.view.sunGlow.visible = false;
      SB.view.moon.visible = true;
    } else {
      scene.fog.color.setHex(0xd98a6a);
      SB.view.hemi.intensity = 0.7;
      SB.view.hemi.color.setHex(0xffb38a);
      SB.view.dirLight.intensity = 0.95;
      SB.view.dirLight.color.setHex(0xff9a5c);
      if (SB.view.fillLight) SB.view.fillLight.intensity = 0.35;
      SB.view.sun.visible = true;
      SB.view.sunGlow.visible = true;
      SB.view.moon.visible = false;
    }
  }

  SB.buildWorld = buildWorld;
  SB.setTimeOfDay = setTimeOfDay;
  SB.buildPalm = buildPalm;
})();
