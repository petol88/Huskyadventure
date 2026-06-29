/*
 * input.js — Ohjaus
 * Yhdistää näppäimistön ja kosketusohjauksen (virtuaalinen ohjaussauva)
 * yhdeksi suuntavektoriksi, jota peli lukee joka ruudunpäivityksellä.
 */

const Input = (() => {
  // Suuntavektori välillä -1..1 molemmilla akseleilla
  const dir = { x: 0, y: 0 };
  const keys = {};
  let sprinting = false; // pidetäänkö sprint-painiketta pohjassa
  let howlQueued = false; // kertalaukaus: ulvonta-painallus odottaa käsittelyä

  // --- Näppäimistö ---
  const keyMap = {
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
  };

  window.addEventListener('keydown', (e) => {
    if (keyMap[e.code]) {
      keys[keyMap[e.code]] = true;
      e.preventDefault();
    }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') sprinting = true;
    if (e.code === 'Space') { howlQueued = true; e.preventDefault(); }
  });

  window.addEventListener('keyup', (e) => {
    if (keyMap[e.code]) {
      keys[keyMap[e.code]] = false;
      e.preventDefault();
    }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') sprinting = false;
  });

  // --- Kosketusohjaus (joystick) ---
  const touch = { active: false, x: 0, y: 0 };
  const joystick = document.getElementById('joystick');
  const knob = document.getElementById('joystick-knob');
  const maxRadius = 45; // kuinka kauas nuppi voi liikkua keskeltä

  // Tunnista kosketuslaite ja näytä ohjaimet
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
    document.body.classList.add('touch');
  }

  function handleTouch(e) {
    const t = e.touches[0];
    const rect = joystick.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    let dx = t.clientX - cx;
    let dy = t.clientY - cy;
    const dist = Math.hypot(dx, dy);

    if (dist > maxRadius) {
      dx = (dx / dist) * maxRadius;
      dy = (dy / dist) * maxRadius;
    }

    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    touch.active = true;
    touch.x = dx / maxRadius;
    touch.y = dy / maxRadius;
  }

  function resetTouch() {
    touch.active = false;
    touch.x = 0;
    touch.y = 0;
    knob.style.transform = 'translate(0, 0)';
  }

  if (joystick) {
    joystick.addEventListener('touchstart', handleTouch, { passive: false });
    joystick.addEventListener('touchmove', (e) => { e.preventDefault(); handleTouch(e); }, { passive: false });
    joystick.addEventListener('touchend', resetTouch);
    joystick.addEventListener('touchcancel', resetTouch);
  }

  // Sprint-painike (kosketus)
  const sprintBtn = document.getElementById('sprint-btn');
  if (sprintBtn) {
    sprintBtn.addEventListener('touchstart', (e) => { e.preventDefault(); sprinting = true; sprintBtn.classList.add('active'); }, { passive: false });
    const endSprint = (e) => { if (e) e.preventDefault(); sprinting = false; sprintBtn.classList.remove('active'); };
    sprintBtn.addEventListener('touchend', endSprint);
    sprintBtn.addEventListener('touchcancel', endSprint);
  }

  // Ulvonta-painike (kosketus) — kertalaukaus
  const howlBtn = document.getElementById('howl-btn');
  if (howlBtn) {
    howlBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      howlQueued = true;
      howlBtn.classList.add('active');
    }, { passive: false });
    const endHowl = (e) => { if (e) e.preventDefault(); howlBtn.classList.remove('active'); };
    howlBtn.addEventListener('touchend', endHowl);
    howlBtn.addEventListener('touchcancel', endHowl);
  }

  // --- Yhdistetty suunta ---
  function getDirection() {
    if (touch.active) {
      dir.x = touch.x;
      dir.y = touch.y;
    } else {
      dir.x = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      dir.y = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
      // Normalisoi vinottain liikkuminen, ettei se ole nopeampaa
      const len = Math.hypot(dir.x, dir.y);
      if (len > 1) {
        dir.x /= len;
        dir.y /= len;
      }
    }
    return dir;
  }

  function isSprinting() {
    return sprinting;
  }

  // Palauttaa true kerran ulvonta-painallusta kohden (kertalaukaus)
  function consumeHowl() {
    if (howlQueued) {
      howlQueued = false;
      return true;
    }
    return false;
  }

  return { getDirection, isSprinting, consumeHowl };
})();
