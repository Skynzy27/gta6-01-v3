// SPDX-License-Identifier: MIT
// Solmar Bay 3D — audio: all sound is synthesized with WebAudio. No audio
// files, no network. Radio is a 16-step sequencer per station; sirens,
// engine hum and effects are oscillators and filtered noise.
(function () {
  'use strict';

  const A = {
    ctx: null, master: null, radioGain: null, engineOsc: null, engineGain: null,
    sirenTimer: null, sirenOn: false, radioTimer: null, step: 0, nextTime: 0,
    station: 0, noiseBuf: null
  };

  function init() {
    if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    A.ctx = new Ctx();
    A.master = A.ctx.createGain();
    A.master.gain.value = SB.state.muted ? 0 : 0.5;
    A.master.connect(A.ctx.destination);
    A.radioGain = A.ctx.createGain();
    A.radioGain.gain.value = 0.16;
    A.radioGain.connect(A.master);
    A.engineGain = A.ctx.createGain();
    A.engineGain.gain.value = 0;
    A.engineGain.connect(A.master);
    A.engineOsc = A.ctx.createOscillator();
    A.engineOsc.type = 'sawtooth';
    A.engineOsc.frequency.value = 50;
    const lp = A.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 320;
    A.engineOsc.connect(lp); lp.connect(A.engineGain);
    A.engineOsc.start();
    // White-noise buffer for drums, gunshots and crashes.
    const len = A.ctx.sampleRate;
    A.noiseBuf = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
    const d = A.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i += 1) d[i] = Math.random() * 2 - 1;
    startRadio();
  }

  function midiToFreq(semi) { return 110 * Math.pow(2, semi / 12); }

  function blip(freq, dur, type, gain, when) {
    if (!A.ctx) return;
    const t = when || A.ctx.currentTime;
    const o = A.ctx.createOscillator();
    const g = A.ctx.createGain();
    o.type = type || 'square';
    o.frequency.value = freq;
    g.gain.setValueAtTime(gain || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(A.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function noiseHit(dur, freq, gain, when) {
    if (!A.ctx) return;
    const t = when || A.ctx.currentTime;
    const s = A.ctx.createBufferSource();
    s.buffer = A.noiseBuf;
    const f = A.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = freq || 1200;
    const g = A.ctx.createGain();
    g.gain.setValueAtTime(gain || 0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(A.master);
    s.start(t); s.stop(t + dur + 0.02);
  }

  // One sequencer step: bass note, lead note, kick on 0/4/8/12, hat every 2.
  function scheduleStep(step, time) {
    const st = SB.STATIONS[A.station];
    const bass = st.bass[step];
    const lead = st.lead[step];
    if (bass) blip(midiToFreq(bass - 12), 0.22, 'triangle', 0.5, time);
    if (lead) blip(midiToFreq(lead), 0.16, 'sawtooth', 0.16, time);
    if (step % 4 === 0) { // kick
      if (!A.ctx) return;
      const o = A.ctx.createOscillator();
      const g = A.ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(120, time);
      o.frequency.exponentialRampToValueAtTime(40, time + 0.12);
      g.gain.setValueAtTime(0.5, time);
      g.gain.exponentialRampToValueAtTime(0.001, time + 0.14);
      o.connect(g); g.connect(A.radioGain);
      o.start(time); o.stop(time + 0.16);
    }
    if (step % 2 === 0) noiseHit(0.03, 6000, 0.08, time);
  }

  function startRadio() {
    if (A.radioTimer || !A.ctx) return;
    A.step = 0;
    A.nextTime = A.ctx.currentTime + 0.1;
    A.radioTimer = setInterval(function () {
      if (!A.ctx) return;
      const st = SB.STATIONS[A.station];
      const stepDur = 60 / st.bpm / 4;
      while (A.nextTime < A.ctx.currentTime + 0.25) {
        scheduleStep(A.step, A.nextTime);
        A.nextTime += stepDur;
        A.step = (A.step + 1) % 16;
      }
    }, 90);
  }

  function setStation(i) {
    A.station = ((i % SB.STATIONS.length) + SB.STATIONS.length) % SB.STATIONS.length;
    SB.state.radio = A.station;
  }

  function setEngine(speedNorm, on) {
    if (!A.ctx || !A.engineOsc) return;
    const t = A.ctx.currentTime;
    A.engineOsc.frequency.setTargetAtTime(42 + speedNorm * 130, t, 0.08);
    A.engineGain.gain.setTargetAtTime(on ? 0.05 + speedNorm * 0.06 : 0, t, 0.1);
  }

  function setSiren(on) {
    if (on === A.sirenOn) return;
    A.sirenOn = on;
    if (on && !A.sirenTimer) {
      let hi = false;
      A.sirenTimer = setInterval(function () {
        if (!A.ctx) return;
        hi = !hi;
        blip(hi ? 880 : 660, 0.32, 'sine', 0.05);
      }, 340);
    } else if (!on && A.sirenTimer) {
      clearInterval(A.sirenTimer);
      A.sirenTimer = null;
    }
  }

  function shoot() { noiseHit(0.09, 2400, 0.35); blip(180, 0.07, 'square', 0.18); }
  function punch() { noiseHit(0.08, 900, 0.3); }
  function pickup() { blip(660, 0.08, 'sine', 0.25); setTimeout(function () { blip(990, 0.12, 'sine', 0.25); }, 70); }
  function crash() { noiseHit(0.25, 500, 0.4); }
  function click() { blip(520, 0.05, 'sine', 0.15); }
  function denied() { blip(160, 0.15, 'square', 0.15); }
  function missionDone() {
    const notes = [523, 659, 784, 1046];
    notes.forEach(function (f, i) { setTimeout(function () { blip(f, 0.22, 'triangle', 0.25); }, i * 110); });
  }
  function wantedUp() { blip(220, 0.15, 'sawtooth', 0.2); setTimeout(function () { blip(220, 0.15, 'sawtooth', 0.2); }, 160); }

  function setMuted(m) {
    SB.state.muted = m;
    if (A.master) A.master.gain.value = m ? 0 : 0.5;
  }

  SB.Audio = {
    init: init, setStation: setStation, setEngine: setEngine, setSiren: setSiren,
    shoot: shoot, punch: punch, pickup: pickup, crash: crash, click: click,
    denied: denied, missionDone: missionDone, wantedUp: wantedUp, setMuted: setMuted,
    stationName: function () { return SB.STATIONS[A.station].name + ' · ' + SB.STATIONS[A.station].desc; },
    trackName: function () { return SB.STATIONS[A.station].artist; }
  };
})();
