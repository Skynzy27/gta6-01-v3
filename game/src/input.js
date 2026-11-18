// SPDX-License-Identifier: MIT
// Solmar Bay 3D — input: keyboard state, mouse look, and one-shot actions
// (interact, weapon switch, camera toggle, map, radio). Main loop polls.
(function () {
  'use strict';

  const keys = {};
  let mouseDX = 0, mouseDY = 0, mouseDown = false, clicked = false;
  let interactQueued = false, pointerLocked = false;

  window.addEventListener('keydown', function (e) {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].indexOf(e.code) >= 0) e.preventDefault();
    if (e.repeat) return;
    keys[e.code] = true;
    if (e.code === 'KeyE') interactQueued = true;
  });
  window.addEventListener('keyup', function (e) { keys[e.code] = false; });
  window.addEventListener('blur', function () { for (const k in keys) keys[k] = false; });

  document.addEventListener('mousemove', function (e) {
    if (pointerLocked) { mouseDX += e.movementX; mouseDY += e.movementY; }
  });
  document.addEventListener('mousedown', function (e) {
    if (e.button === 0) { mouseDown = true; clicked = true; }
  });
  document.addEventListener('mouseup', function (e) {
    if (e.button === 0) mouseDown = false;
  });
  document.addEventListener('pointerlockchange', function () {
    pointerLocked = document.pointerLockElement === document.getElementById('game');
  });

  function lockPointer() {
    const canvas = document.getElementById('game');
    if (canvas && canvas.requestPointerLock) {
      try {
        const p = canvas.requestPointerLock();
        if (p && p.catch) p.catch(function () { /* headless or denied: mouse aim still works */ });
      } catch (err) { /* ignore */ }
    }
  }

  function axis() {
    return {
      fwd: (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0),
      strafe: (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0),
      sprint: !!keys.ShiftLeft || !!keys.ShiftRight,
      drift: !!keys.Space,
      enter: !!keys.KeyF,
      reload: !!keys.KeyR
    };
  }

  function consumeMouse() {
    const dx = mouseDX, dy = mouseDY;
    mouseDX = 0; mouseDY = 0;
    return { dx: dx, dy: dy };
  }

  function consumeClick() { const c = clicked; clicked = false; return c; }
  function consumeInteract() { const v = interactQueued; interactQueued = false; return v; }
  function isDown() { return mouseDown; }
  function pressed(code) {
    const v = !!keys[code];
    if (v) keys[code] = false;
    return v;
  }

  SB.Input = {
    keys: keys, axis: axis, consumeMouse: consumeMouse, consumeClick: consumeClick,
    consumeInteract: consumeInteract, isDown: isDown, pressed: pressed,
    lockPointer: lockPointer, isLocked: function () { return pointerLocked; }
  };
})();
