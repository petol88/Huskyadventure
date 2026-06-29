/*
 * audio.js — Äänet & musiikki
 * Kaikki äänet syntetisoidaan Web Audio APIlla (ei äänitiedostoja).
 * - Audio.unlock()  : käynnistä AudioContext käyttäjän eleestä (selainpakko)
 * - Audio.play(name): soita äänitehoste
 * - Audio.startMusic()/stopMusic()/setTension(v): taustamusiikki
 * - Audio.toggle()  : mykistys päälle/pois (palauttaa onko ääni päällä)
 */

const Audio = (() => {
  let ctx = null;
  let masterGain = null;
  let musicGain = null;
  let enabled = true;

  // Musiikin tila
  let beatTimer = null;
  let step = 0;
  let tensionGain = null;   // jännitys-dronen voimakkuus
  let tensionTarget = 0;

  function init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    masterGain = ctx.createGain();
    masterGain.gain.value = enabled ? 0.6 : 0;
    masterGain.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.5;
    musicGain.connect(masterGain);
  }

  function unlock() {
    init();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  // --- Perusäänet ---
  function blip(freq, type, dur, gain, slideTo, when = 0, dest) {
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest || masterGain);
    o.start(t);
    o.stop(t + dur + 0.03);
  }

  function noiseBurst(dur, gain, filterFreq, when = 0) {
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const buf = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * dur)), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = src;
    if (filterFreq) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = filterFreq;
      src.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(masterGain);
    src.start(t);
    src.stop(t + dur);
  }

  // Ulvonta: liukuu ylös ja takaisin alas, vibratolla
  function howl() {
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(280, t);
    o.frequency.linearRampToValueAtTime(620, t + 0.25);
    o.frequency.setValueAtTime(620, t + 0.45);
    o.frequency.linearRampToValueAtTime(240, t + 0.95);
    // Vibrato
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 6;
    lfoGain.gain.value = 18;
    lfo.connect(lfoGain);
    lfoGain.connect(o.frequency);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 1400;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.3, t + 0.08);
    g.gain.setValueAtTime(0.3, t + 0.55);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
    o.connect(f);
    f.connect(g);
    g.connect(masterGain);
    o.start(t); lfo.start(t);
    o.stop(t + 1.05); lfo.stop(t + 1.05);
  }

  // --- Äänitehosteet ---
  function play(name) {
    if (!ctx || !enabled) return;
    switch (name) {
      case 'catch':
        blip(660, 'square', 0.08, 0.22, 880);
        blip(990, 'square', 0.09, 0.18, 1320, 0.07);
        break;
      case 'bone':
        blip(520, 'triangle', 0.12, 0.22, 640);
        break;
      case 'goldbone':
        [660, 880, 1320].forEach((f, i) => blip(f, 'sine', 0.12, 0.2, f * 1.05, i * 0.06));
        break;
      case 'hurt':
        blip(180, 'sawtooth', 0.28, 0.3, 70);
        noiseBurst(0.2, 0.22, 900);
        break;
      case 'howl':
        howl();
        break;
      case 'levelup':
        [523, 659, 784, 1047].forEach((f, i) => blip(f, 'triangle', 0.18, 0.22, f, i * 0.08));
        break;
      case 'skill':
        blip(784, 'sine', 0.12, 0.22, 880);
        blip(1175, 'sine', 0.16, 0.2, 1320, 0.09);
        break;
      case 'charge': // syöksyvaroitus
        blip(900, 'sawtooth', 0.18, 0.26, 480);
        blip(900, 'sawtooth', 0.18, 0.22, 480, 0.22);
        break;
      case 'boss':
        blip(120, 'sawtooth', 0.7, 0.3, 90);
        noiseBurst(0.5, 0.18, 400);
        break;
      case 'gameover':
        [440, 330, 247, 165].forEach((f, i) => blip(f, 'sawtooth', 0.35, 0.25, f * 0.95, i * 0.18));
        break;
      case 'map': // aarrekartta löytyi
        noiseBurst(0.18, 0.1, 2500);
        blip(523, 'triangle', 0.14, 0.18, 784);
        blip(784, 'triangle', 0.18, 0.16, 1047, 0.1);
        break;
      case 'dig': // kaivamisen kopsahdus
        blip(140, 'sine', 0.1, 0.2, 90);
        noiseBurst(0.08, 0.12, 600);
        break;
      case 'gem': // jalokivi löytyi — kirkas riemu
        [784, 1047, 1319, 1568, 2093].forEach((f, i) => blip(f, 'sine', 0.22, 0.2, f, i * 0.07));
        blip(523, 'triangle', 0.6, 0.12, 523, 0.1);
        break;
      case 'clue': // aarreketju jatkuu — vihje eteenpäin
        blip(660, 'triangle', 0.14, 0.18, 880);
        blip(880, 'triangle', 0.16, 0.16, 1175, 0.1);
        break;
      case 'legendary': // legendaarinen aarre — mahtipontinen fanfaari
        [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => blip(f, 'triangle', 0.3, 0.22, f, i * 0.1));
        [262, 330, 392].forEach((f, i) => blip(f, 'sawtooth', 0.8, 0.12, f, i * 0.1 + 0.2));
        noiseBurst(0.3, 0.08, 6000, 0.05);
        break;
      case 'artifact': // muinaisesine löytyi — mystinen helinä
        [659, 988, 1319, 1976].forEach((f, i) => blip(f, 'sine', 0.4, 0.18, f * 1.01, i * 0.09));
        blip(330, 'triangle', 0.9, 0.12, 330, 0.05);
        break;
      case 'shield': // kilpi torjui osuman — metallinen kalahdus
        blip(700, 'square', 0.1, 0.18, 500);
        blip(1100, 'sine', 0.18, 0.14, 700, 0.02);
        noiseBurst(0.12, 0.1, 3000);
        break;
      default:
        break;
    }
  }

  // --- Taustamusiikki: kevyt pentatoninen arpeggio + jännitys-drone ---
  const SCALE = [261.63, 311.13, 349.23, 392.0, 466.16, 523.25]; // c-mollipentatoninen-ish
  const PATTERN = [0, 2, 4, 2, 3, 1, 4, 5];

  function startMusic() {
    if (!ctx || beatTimer) return;
    // Jännitys-drone: matala saha + lowpass, voimakkuus 0
    const drone = ctx.createOscillator();
    const drone2 = ctx.createOscillator();
    drone.type = 'sawtooth'; drone2.type = 'sawtooth';
    drone.frequency.value = 55; drone2.frequency.value = 55 * 1.01; // kevyt huojunta
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 200;
    tensionGain = ctx.createGain();
    tensionGain.gain.value = 0;
    drone.connect(lp); drone2.connect(lp);
    lp.connect(tensionGain);
    tensionGain.connect(masterGain);
    drone.start(); drone2.start();
    tensionGain._osc = [drone, drone2];

    step = 0;
    beatTimer = setInterval(() => {
      // Pehmeä arpeggio-nuotti
      const n = SCALE[PATTERN[step % PATTERN.length]];
      blip(n, 'triangle', 0.32, 0.07, n, 0, musicGain);
      // Basso joka 4. isku
      if (step % 4 === 0) blip(n / 2, 'sine', 0.5, 0.08, n / 2, 0, musicGain);
      step++;
      // Liu'uta jännitys kohti tavoitetta
      if (tensionGain) {
        const cur = tensionGain.gain.value;
        const next = cur + (tensionTarget * 0.14 - cur) * 0.5;
        tensionGain.gain.setTargetAtTime(next, ctx.currentTime, 0.1);
      }
    }, 390);
  }

  function stopMusic() {
    if (beatTimer) { clearInterval(beatTimer); beatTimer = null; }
    if (tensionGain && tensionGain._osc) {
      const t = ctx.currentTime;
      tensionGain.gain.setTargetAtTime(0, t, 0.1);
      tensionGain._osc.forEach((o) => { try { o.stop(t + 0.3); } catch (e) {} });
      tensionGain = null;
    }
  }

  // v = 0..1 (esim. kuinka moni peto jahtaa)
  function setTension(v) {
    tensionTarget = Math.max(0, Math.min(1, v));
  }

  function toggle() {
    enabled = !enabled;
    if (masterGain) {
      masterGain.gain.setTargetAtTime(enabled ? 0.6 : 0, ctx.currentTime, 0.05);
    }
    return enabled;
  }

  function isEnabled() { return enabled; }

  return { unlock, play, startMusic, stopMusic, setTension, toggle, isEnabled };
})();
