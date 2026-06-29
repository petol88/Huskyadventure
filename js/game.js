/*
 * game.js — Pelin ydin
 * Hoitaa pelisilmukan, tasot & vaikeustason, kentän generoinnin,
 * törmäykset ja pelitilat (aloitus → peli → game over).
 */

(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const levelEl = document.getElementById('level');
  const progressEl = document.getElementById('progress');
  const goalEl = document.getElementById('goal');
  const huskyLevelEl = document.getElementById('huskyLevel');
  const gemsEl = document.getElementById('gems');
  const livesEl = document.getElementById('lives');
  const xpFillEl = document.getElementById('xpfill');
  const perksEl = document.getElementById('perks');
  const bannerEl = document.getElementById('banner');
  const overlay = document.getElementById('overlay');
  const overlayText = document.getElementById('overlay-text');
  const startBtn = document.getElementById('start-btn');
  const highscoresEl = document.getElementById('highscores');
  const muteBtn = document.getElementById('mute-btn');

  muteBtn.addEventListener('click', () => {
    Audio.unlock();
    const on = Audio.toggle();
    muteBtn.textContent = on ? '🔊' : '🔇';
  });
  const skillOverlay = document.getElementById('skill-overlay');
  const skillCardsEl = document.getElementById('skill-cards');
  const huskyLevelUpEl = document.getElementById('huskyLevelUp');

  // Näkymän (viewportin) koko — tämä on canvasin koko, joka skaalataan ruutuun.
  // Kamera näyttää tämän kokoisen palan isommasta maailmasta.
  const viewport = { width: 960, height: 640 };
  // Pelimaailma on selvästi viewporttia isompi → kamera seuraa huskya.
  const world = { width: 1920, height: 1280 };
  const center = { x: world.width / 2, y: world.height / 2 };
  const cam = { x: 0, y: 0 };

  // --- Biomit: jokaisella tasolla oma teema (värit, esteet, eläimet) ---
  const BIOMES = [
    { id: 'forest', name: 'Metsä', emoji: '🌲', ground: '#3a5a3a', grid: 'rgba(255,255,255,0.04)',
      rockFill: '#6b6b72', rockStroke: '#4a4a50', bushFill: '#2e7d32', bushEmoji: '🌳',
      prey: ['rabbit', 'mouse', 'squirrel', 'hedgehog', 'bird'] },
    { id: 'snow', name: 'Lumiaava', emoji: '❄️', ground: '#c2cedd', grid: 'rgba(90,110,140,0.10)',
      rockFill: '#9fb3c8', rockStroke: '#7c93ad', bushFill: '#eaf2fa', bushEmoji: '🌲',
      prey: ['rabbit', 'mouse', 'hedgehog', 'bird'] },
    { id: 'desert', name: 'Aavikko', emoji: '🏜️', ground: '#d8c088', grid: 'rgba(120,90,40,0.08)',
      rockFill: '#b89a64', rockStroke: '#947a4c', bushFill: '#7e8b3a', bushEmoji: '🌵',
      prey: ['mouse', 'squirrel', 'bird', 'hedgehog'] },
    { id: 'swamp', name: 'Suo', emoji: '🌿', ground: '#2c3a2c', grid: 'rgba(130,170,130,0.06)',
      rockFill: '#5a6450', rockStroke: '#3e463a', bushFill: '#3a5a3a', bushEmoji: '🌿',
      prey: ['rabbit', 'mouse', 'squirrel', 'hedgehog', 'bird'] },
  ];
  function biomeForLevel(lv) { return BIOMES[(lv - 1) % BIOMES.length]; }
  let biome = BIOMES[0];

  // --- Vuorokausi & sää ---
  let timeOfDay = 0.3;            // 0=keskiyö, 0.25=aamu, 0.5=keskipäivä, 0.75=ilta
  const DAY_LENGTH = 110;         // sekuntia / täysi vuorokausi
  let weather = 'clear';          // 'clear' | 'rain' | 'snow' | 'fog'
  let weatherParticles = [];

  function envLight() { return Math.max(0, Math.sin(timeOfDay * Math.PI)); } // 0 yö .. 1 päivä

  // Ympäristön näkyvyyskerroin petojen näölle (yö + sää heikentää)
  function envDetectMul() {
    let m = 1 - (1 - envLight()) * 0.4; // yöllä jopa -40 %
    if (weather === 'rain') m *= 0.85;
    else if (weather === 'fog') m *= 0.7;
    else if (weather === 'snow') m *= 0.92;
    return m;
  }

  function pickWeather(biomeId) {
    const r = Math.random();
    if (biomeId === 'desert') return r < 0.72 ? 'clear' : r < 0.92 ? 'fog' : 'rain';
    if (biomeId === 'snow') return r < 0.45 ? 'snow' : r < 0.75 ? 'clear' : r < 0.9 ? 'fog' : 'rain';
    if (biomeId === 'swamp') return r < 0.4 ? 'fog' : r < 0.7 ? 'rain' : r < 0.9 ? 'clear' : 'snow';
    return r < 0.5 ? 'clear' : r < 0.75 ? 'rain' : r < 0.9 ? 'fog' : 'snow'; // metsä
  }

  function initWeatherParticles() {
    weatherParticles = [];
    if (weather === 'rain') {
      for (let i = 0; i < 150; i++) weatherParticles.push({
        x: Math.random() * viewport.width, y: Math.random() * viewport.height,
        len: 9 + Math.random() * 12, sp: 650 + Math.random() * 350 });
    } else if (weather === 'snow') {
      for (let i = 0; i < 90; i++) weatherParticles.push({
        x: Math.random() * viewport.width, y: Math.random() * viewport.height,
        r: 1.5 + Math.random() * 2.5, sp: 40 + Math.random() * 45, drift: Math.random() * Math.PI * 2 });
    }
  }

  function weatherEmoji() {
    return weather === 'rain' ? '🌧️' : weather === 'snow' ? '🌨️' : weather === 'fog' ? '🌫️' : '☀️';
  }

  let husky, prey, predators, obstacles;
  let scene = 'field';        // 'field' (ulkona) | 'interior' (talon/kolon sisällä)
  let structures = [];        // talot ja kolot kentällä
  let interior = null;        // aktiivinen sisätila
  let returnPos = { x: 0, y: 0 }; // mihin husky palaa kun poistuu sisätilasta
  let level = 1;
  let score = 0;            // pyydystetyt yhteensä (koko peli)
  let caughtThisLevel = 0;  // edistyminen nykyisellä tasolla
  let goal = 8;             // montako pyydystettävä päästäkseen seuraavalle tasolle
  let lives = 3;
  let maxLives = 3;
  let running = false;
  let lastTime = 0;
  let invulnTimer = 0;      // lyhyt suoja-aika osuman jälkeen
  let howlRings = [];       // laajenevat ulvonta-aallot (visuaalinen)
  let particles = [];       // hiukkaset (nappauspurske ym.)
  let shakeTimer = 0;       // ruudun tärinän kesto
  let flashTimer = 0;       // punaisen osumavälähdyksen kesto
  let collectibles = [];    // keräiltävät luut (aktiivisen kohtauksen)
  let fieldCollectibles = []; // kentän luut talteen sisätilassa ollessa
  let gameTime = 0;         // kulunut peliaika (luiden leijunta-animaatioon)
  let digSpots = [];        // aarrekarttojen merkitsemät kaivuupaikat [{x,y,progress,step,totalSteps}]
  let gemsFound = 0;        // löydetyt jalokivet
  let artifactsOwned = [];  // tällä pelikerralla hankitut muinaisesineet (id-lista)
  const DIG_RADIUS = 32;    // kuinka lähellä ❌:ää pitää olla kaivaakseen
  const DIG_TIME = 1.6;     // kaivamisen kesto sekunteina
  const SHIELD_RECHARGE = 11; // Muinaisen kilven latautumisaika sekunteina

  // Huskyn oma kokemustaso ja taidot
  let perks = Skills.freshPerks();
  let huskyLevel = 1;
  let huskyXp = 0;
  let xpToNext = 4;

  function xpForHuskyLevel(lv) { return 4 + (lv - 1) * 2; } // Lv1→4, Lv2→6, Lv3→8 ...

  // --- Ennätykset (localStorage) ---
  const HS_KEY = 'huskyAdventures.highscores';
  function loadHighScores() {
    try { return JSON.parse(localStorage.getItem(HS_KEY)) || {}; } catch (e) { return {}; }
  }
  function saveHighScores() {
    try { localStorage.setItem(HS_KEY, JSON.stringify(highScores)); } catch (e) { /* esim. yksityistila */ }
  }
  let highScores = loadHighScores(); // { bestLevel, bestScore, bestHuskyLevel }

  function renderHighScores(newRecord) {
    const hs = highScores;
    if (!hs.bestLevel && !hs.bestScore) { highscoresEl.innerHTML = ''; return; }
    highscoresEl.innerHTML =
      (newRecord ? '<div class="record-badge">🏆 Uusi ennätys!</div>' : '') +
      '<div class="hs-title">Parhaat tulokset</div>' +
      `<div class="hs-row"><span>🏆 Taso</span><b>${hs.bestLevel || 0}</b></div>` +
      `<div class="hs-row"><span>🐾 Saalis</span><b>${hs.bestScore || 0}</b></div>` +
      `<div class="hs-row"><span>🦴 Husky Lv</span><b>${hs.bestHuskyLevel || 1}</b></div>` +
      `<div class="hs-row"><span>💎 Jalokivet</span><b>${hs.bestGems || 0}</b></div>` +
      `<div class="hs-row"><span>🏺 Muinaisesineet</span><b>${hs.bestArtifacts || 0}/${ARTIFACTS.length}</b></div>`;
  }

  // Aktiivinen maailma riippuu kohtauksesta (ulkona vs. sisätila)
  function activeWorld() {
    return scene === 'interior' ? interior.world : world;
  }

  // Kamera keskittyy huskyyn, mutta ei mene maailman reunojen yli.
  // Jos maailma on viewporttia pienempi (sisätila), keskitetään se.
  function updateCamera() {
    const w = activeWorld();
    if (w.width <= viewport.width) cam.x = (w.width - viewport.width) / 2;
    else cam.x = clamp(husky.x - viewport.width / 2, 0, w.width - viewport.width);
    if (w.height <= viewport.height) cam.y = (w.height - viewport.height) / 2;
    else cam.y = clamp(husky.y - viewport.height / 2, 0, w.height - viewport.height);
  }

  // --- Canvasin skaalaus ruudun mukaan ---
  function resize() {
    const scale = Math.min(
      window.innerWidth / viewport.width,
      window.innerHeight / viewport.height
    );
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.width = `${viewport.width * scale}px`;
    canvas.style.height = `${viewport.height * scale}px`;
  }
  window.addEventListener('resize', resize);
  resize();

  function randomPos(margin = 60) {
    return {
      x: margin + Math.random() * (world.width - margin * 2),
      y: margin + Math.random() * (world.height - margin * 2),
    };
  }

  // --- Tasokohtaiset asetukset (vaikeus kasvaa) ---
  function goalForLevel(lv) { return 6 + lv * 2; }        // L1:8, L2:10, L3:12 ...
  function preyOnField(lv) { return Math.min(7 + lv, 13); } // montako saalista isolla kentällä yhtä aikaa

  // Generoi kenttä: pusikoita (piilo) ja kiviä (näköeste). Isompi maailma → enemmän esteitä.
  // Ei mene päällekkäin esteiden, keskuksen (aloituspaikka) eikä rakennusten kanssa.
  function generateObstacles(lv) {
    const obs = [];
    const bushCount = Math.min(10 + lv * 2, 24);
    const rockCount = Math.min(6 + lv, 16);

    function tryPlace(type, rMin, rMax) {
      for (let attempt = 0; attempt < 40; attempt++) {
        const radius = rMin + Math.random() * (rMax - rMin);
        const p = randomPos(70);
        if (Math.hypot(p.x - center.x, p.y - center.y) < 110) continue; // jätä keskus vapaaksi
        // älä tuki rakennusten sisäänkäyntejä
        if (structures.some((s) => Math.hypot(p.x - s.x, p.y - s.y) < 90 + radius)) continue;
        let ok = true;
        for (const o of obs) {
          if (Math.hypot(p.x - o.x, p.y - o.y) < o.radius + radius + 28) { ok = false; break; }
        }
        if (ok) { obs.push(new Obstacle(p.x, p.y, radius, type)); return; }
      }
    }

    for (let i = 0; i < bushCount; i++) tryPlace('bush', 38, 55);
    for (let i = 0; i < rockCount; i++) tryPlace('rock', 30, 42);
    return obs;
  }

  // --- Rakennukset: talot (🏠) ja kolot (🕳️) joihin voi mennä sisään ---
  function createStructures(lv) {
    const list = [];
    const count = 2 + Math.floor(Math.random() * 2); // 2–3 rakennusta
    for (let i = 0; i < count; i++) {
      for (let attempt = 0; attempt < 40; attempt++) {
        const p = randomPos(140);
        if (Math.hypot(p.x - center.x, p.y - center.y) < 220) continue; // ei keskelle
        if (list.some((s) => Math.hypot(p.x - s.x, p.y - s.y) < 320)) continue; // erilleen
        const kind = Math.random() < 0.5 ? 'house' : 'den';
        list.push({
          x: p.x, y: p.y, radius: 42, kind, looted: false,
          hasNpc: kind === 'house' && Math.random() < 0.55,  // talossa joskus ystävä
          hasTraps: kind === 'den' && Math.random() < 0.55,  // kolossa joskus ansoja
          npcHelped: false,
        });
        break;
      }
    }
    return list;
  }

  function isBossLevel(lv) { return lv % 5 === 0; }

  // Pedot tasoittain: enemmän ja nopeampia. Joka 5. taso on pomotaso.
  function predatorsForLevel(lv) {
    const speedMul = 1 + (lv - 1) * 0.06;
    const corners = [
      { x: 120, y: 120 },
      { x: world.width - 120, y: world.height - 120 },
      { x: world.width - 120, y: 120 },
      { x: 120, y: world.height - 120 },
    ];

    if (isBossLevel(lv)) {
      // Iso pomo keskellä ylhäällä, + apureita korkeammilla tasoilla
      const bossKind = ((lv / 5) % 2 === 1) ? 'wolf' : 'bear';
      const list = [new Predator(center.x, 120, bossKind, speedMul, true)];
      if (lv >= 10) list.push(new Predator(corners[3].x, corners[3].y, 'fox', speedMul));
      if (lv >= 15) list.push(new Predator(corners[2].x, corners[2].y, 'wolf', speedMul));
      return list;
    }

    const count = Math.min(lv, 4);
    const list = [];
    for (let i = 0; i < count; i++) {
      // Karhu/susi vuorotellen; kettu liittyy mukaan tasolta 3 (viimeisenä)
      let kind = i % 2 === 0 ? 'bear' : 'wolf';
      if (lv >= 3 && i === count - 1) kind = 'fox';
      list.push(new Predator(corners[i].x, corners[i].y, kind, speedMul));
    }
    return list;
  }

  // --- Saaliin luonti ---
  function spawnOnePrey() {
    const kinds = biome.prey; // biomi määrää mitkä eläimet esiintyvät
    // Ilmesty etäälle huskysta, ettei pääse heti kiinni
    for (let attempt = 0; attempt < 30; attempt++) {
      const p = randomPos(50);
      if (Math.hypot(p.x - husky.x, p.y - husky.y) > 150) {
        return new Prey(p.x, p.y, kinds[Math.floor(Math.random() * kinds.length)]);
      }
    }
    const p = randomPos(50);
    return new Prey(p.x, p.y, kinds[0]);
  }

  function refillPrey() {
    while (prey.length < preyOnField(level)) prey.push(spawnOnePrey());
  }

  // Luo kentälle keräiltäviä luita (joukossa harvoin kultainen)
  function spawnCollectibles() {
    const list = [];
    const n = 5 + Math.floor(Math.random() * 3); // 5–7 luuta isolla kentällä
    for (let i = 0; i < n; i++) {
      const p = randomPos(70);
      const gold = Math.random() < 0.2; // ~20 % kultainen
      list.push({ x: p.x, y: p.y, radius: 16, gold, phase: Math.random() * Math.PI * 2 });
    }
    return list;
  }

  // --- Sisätilat (talon/kolon sisus) ---
  // Rakenna pieni huone seinineen, uloskäynteineen ja aarteineen.
  function buildInterior(s) {
    const w = { width: 760, height: 540 };
    const walls = [
      // huonekalut/kivet esteinä, tuovat tunnelmaa
      new Obstacle(160, 150, 34, 'rock'),
      new Obstacle(w.width - 170, 160, 30, 'rock'),
      new Obstacle(w.width - 150, w.height - 170, 36, 'rock'),
    ];
    const exit = { x: w.width / 2, y: w.height - 36, r: 32 }; // ovi alareunan keskellä

    // Generoi sisältö KERRAN ja talleta rakennukseen, jotta se säilyy
    // ulos/sisään-käyntien yli (vain jo kerätyt katoavat).
    if (!s.contentBuilt) {
      const loot = [];
      // Päähyödyke: noin 40 % rakennuksista kätkee aarrekartan, muuten ison kultaluun
      if (Math.random() < 0.4) {
        loot.push({ x: w.width / 2, y: 150, radius: 17, map: true, phase: 0 });
      } else {
        loot.push({ x: w.width / 2, y: 150, radius: 18, gold: true, phase: 0 });
      }
      let extra = 2 + Math.floor(Math.random() * 2);
      if (s.kind === 'den') extra += 1; // kolot ovat vaarallisempia → enemmän aarretta
      for (let i = 0; i < extra; i++) {
        loot.push({
          x: 130 + Math.random() * (w.width - 260),
          y: 120 + Math.random() * (w.height - 270),
          radius: 16, gold: Math.random() < (s.kind === 'den' ? 0.4 : 0.3), phase: Math.random() * Math.PI * 2,
        });
      }
      s.loot = loot;
      // Ystävällinen eläin taloissa: auttaa kerran
      s.npc = s.hasNpc
        ? { x: w.width * 0.28, y: w.height * 0.42, radius: 15, kind: 'rabbit', flip: 1, animPhase: 0, moving: false, helped: false }
        : null;
      // Ansat koloissa: piikit jotka satuttavat
      const traps = [];
      if (s.hasTraps) {
        const n = 1 + Math.floor(Math.random() * 2);
        for (let i = 0; i < n; i++) {
          traps.push({ x: 170 + Math.random() * (w.width - 340), y: 160 + Math.random() * (w.height - 300), radius: 26 });
        }
      }
      s.traps = traps;
      s.contentBuilt = true;
    }
    return { world: w, walls, exit, kind: s.kind, loot: s.loot, npc: s.npc, traps: s.traps, struct: s };
  }

  function enterStructure(s) {
    returnPos = { x: s.x, y: s.y + s.radius + husky.radius + 10 }; // ulko-oven eteen
    interior = buildInterior(s);
    fieldCollectibles = collectibles; // talleta kentän luut
    collectibles = interior.loot;     // sisätilan aarteet keräiltäviksi
    husky.x = interior.world.width / 2;
    husky.y = interior.world.height - 95; // oven sisäpuolelle
    husky.hidden = false;
    scene = 'interior';
    invulnTimer = 0.6;
    showBanner(s.kind === 'house' ? '🏠 Sisällä!' : '🕳️ Kolossa!');
    Audio.play('skill');
  }

  function exitInterior() {
    // Tallenna jäljellä oleva (keräämättä jäänyt) tavara rakennukseen
    interior.struct.loot = collectibles;
    scene = 'field';
    interior = null;
    husky.x = clamp(returnPos.x, husky.radius, world.width - husky.radius);
    husky.y = clamp(returnPos.y, husky.radius, world.height - husky.radius);
    collectibles = fieldCollectibles; // palauta kentän luut näkyviin
    invulnTimer = 0.8;
  }

  // --- Pelin alustus ---
  function init() {
    level = 1;
    score = 0;
    caughtThisLevel = 0;
    goal = goalForLevel(level);
    maxLives = 3;
    lives = 3;
    invulnTimer = 0;
    howlRings = [];
    particles = [];
    shakeTimer = 0;
    flashTimer = 0;
    collectibles = [];
    gameTime = 0;
    digSpots = [];
    gemsFound = 0;
    artifactsOwned = [];
    // Nollaa huskyn kokemustaso ja taidot
    perks = Skills.freshPerks();
    huskyLevel = 1;
    huskyXp = 0;
    xpToNext = xpForHuskyLevel(huskyLevel);
    scene = 'field';
    interior = null;
    biome = biomeForLevel(level);
    timeOfDay = 0.3; // aamupäivä
    weather = pickWeather(biome.id);
    initWeatherParticles();
    structures = createStructures(level);
    obstacles = generateObstacles(level); // huom: viittaa structures-listaan
    husky = new Husky(center.x, center.y);
    predators = predatorsForLevel(level);
    prey = [];
    refillPrey();
    collectibles = spawnCollectibles();
    renderPerks();
    updateXpBar();
    updateHud();
  }

  // --- Tasonvaihto ---
  function nextLevel() {
    level++;
    caughtThisLevel = 0;
    goal = goalForLevel(level);
    scene = 'field';
    interior = null;
    biome = biomeForLevel(level);
    weather = pickWeather(biome.id); // sää vaihtuu, vuorokausi jatkuu
    initWeatherParticles();
    digSpots = []; // uusi kenttä → vanhat kaivuupaikat katoavat
    structures = createStructures(level);
    obstacles = generateObstacles(level);
    predators = predatorsForLevel(level);
    husky.x = center.x;
    husky.y = center.y;
    prey = [];
    refillPrey();
    collectibles = spawnCollectibles();
    invulnTimer = 1.0; // pieni armonaika uuteen kenttään
    showBanner(isBossLevel(level)
      ? `👑 POMOTASO ${level} — ${biome.emoji} ${biome.name} ${weatherEmoji()}`
      : `${biome.emoji} ${biome.name} ${weatherEmoji()} — Taso ${level}`);
    Audio.play(isBossLevel(level) ? 'boss' : 'levelup');
    updateHud();
  }

  function showBanner(text) {
    bannerEl.textContent = text;
    bannerEl.classList.remove('show');
    void bannerEl.offsetWidth; // pakota animaation uudelleenkäynnistys
    bannerEl.classList.add('show');
  }

  function updateHud() {
    levelEl.textContent = level;
    progressEl.textContent = caughtThisLevel;
    goalEl.textContent = goal;
    huskyLevelEl.textContent = huskyLevel;
    gemsEl.textContent = gemsFound;
    livesEl.textContent = lives;
  }

  function updateXpBar() {
    const pct = Math.max(0, Math.min(1, huskyXp / xpToNext)) * 100;
    xpFillEl.style.width = `${pct}%`;
  }

  // Näytä opitut taidot pieninä merkkeinä (emoji + kertamäärä)
  function renderPerks() {
    perksEl.innerHTML = '';
    // Muinaisesineet ensin (kultareunaiset)
    for (const id of artifactsOwned) {
      const art = ARTIFACTS.find((a) => a.id === id);
      if (!art) continue;
      const chip = document.createElement('div');
      chip.className = 'perk-chip artifact-chip';
      chip.title = `${art.name}: ${art.desc}`;
      chip.textContent = art.emoji;
      perksEl.appendChild(chip);
    }
    for (const skill of Skills.ALL) {
      const n = perks.taken[skill.id] || 0;
      if (n === 0) continue;
      const chip = document.createElement('div');
      chip.className = 'perk-chip';
      chip.title = `${skill.name}: ${skill.desc}`;
      chip.textContent = n > 1 ? `${skill.emoji}×${n}` : skill.emoji;
      perksEl.appendChild(chip);
    }
  }

  // --- Huskyn taso & taidonvalinta ---
  const skillApi = {
    gainLife() { maxLives++; lives++; updateHud(); },
  };

  function offerSkill() {
    const choices = Skills.roll(perks.taken, 3);
    if (choices.length === 0) {
      // Kaikki taidot opittu — muunna XP pienen bonuksen sijaan vain nollaa
      huskyXp -= xpToNext;
      huskyLevel++;
      xpToNext = xpForHuskyLevel(huskyLevel);
      updateHud();
      updateXpBar();
      return;
    }
    running = false;
    renderSkillCards(choices);
    huskyLevelUpEl.textContent = huskyLevel + 1;
    skillOverlay.classList.remove('hidden');
  }

  function renderSkillCards(choices) {
    skillCardsEl.innerHTML = '';
    for (const skill of choices) {
      const owned = perks.taken[skill.id] || 0;
      const card = document.createElement('button');
      card.className = 'skill-card';
      card.innerHTML =
        `<div class="skill-emoji">${skill.emoji}</div>` +
        `<div class="skill-name">${skill.name}${owned ? ` <span class="lvl">Lv ${owned + 1}</span>` : ''}</div>` +
        `<div class="skill-desc">${skill.desc}</div>`;
      card.addEventListener('click', () => chooseSkill(skill));
      skillCardsEl.appendChild(card);
    }
  }

  function chooseSkill(skill) {
    Audio.play('skill');
    skill.apply(perks, skillApi);
    perks.taken[skill.id] = (perks.taken[skill.id] || 0) + 1;
    huskyLevel++;
    huskyXp -= xpToNext;
    xpToNext = xpForHuskyLevel(huskyLevel);
    renderPerks();
    updateHud();
    updateXpBar();
    skillOverlay.classList.add('hidden');

    if (huskyXp >= xpToNext) {
      offerSkill();        // riitti vielä toiseen tasoon
    } else {
      resumeGame();
    }
  }

  function resumeGame() {
    if (running) return;
    running = true;
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  // --- Törmäystarkistus kahden ympyrän välillä ---
  function collides(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y) < a.radius + b.radius;
  }

  // Hiukkaspurske annetuilla väreillä (nappaus, osuma)
  function spawnBurst(x, y, colors, count) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 130;
      particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.45 + Math.random() * 0.3,
        maxLife: 0.75,
        size: 2 + Math.random() * 3,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
  }

  // Husky ottaa osuman pedosta/ansasta. Muinainen kilpi torjuu yhden.
  // Palauttaa true jos peli päättyi (elämät loppuivat).
  function hurtHusky(sx, sy) {
    const w = activeWorld();
    const dx = husky.x - sx, dy = husky.y - sy, d = Math.hypot(dx, dy) || 1;
    if (perks.hasShield && husky.shieldReady) {
      // Kilpi torjuu: ei menetetä elämää, kilpi latautuu uudelleen
      husky.shieldReady = false;
      husky.shieldCd = SHIELD_RECHARGE;
      invulnTimer = 1.2;
      shakeTimer = 0.2;
      spawnBurst(husky.x, husky.y, ['#7ad0ff', '#bfe0ff', '#fff'], 22);
      showBanner('🛡️ Kilpi suojasi!');
      Audio.play('shield');
      husky.x = clamp(husky.x + (dx / d) * 80, husky.radius, w.width - husky.radius);
      husky.y = clamp(husky.y + (dy / d) * 80, husky.radius, w.height - husky.radius);
      return false;
    }
    lives--;
    invulnTimer = 1.6;
    shakeTimer = 0.4;
    flashTimer = 0.4;
    spawnBurst(husky.x, husky.y, ['#ff5a4a', '#ffac4a'], 14);
    Audio.play('hurt');
    husky.x = clamp(husky.x + (dx / d) * 105, husky.radius, w.width - husky.radius);
    husky.y = clamp(husky.y + (dy / d) * 105, husky.radius, w.height - husky.radius);
    updateHud();
    return lives <= 0;
  }

  // Yhteinen apu: päivitä hiukkaset ja ruutuefektien ajastimet
  function updateEffects(dt) {
    for (const pt of particles) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.9;
      pt.vy *= 0.9;
      pt.life -= dt;
    }
    particles = particles.filter((pt) => pt.life > 0);
    if (shakeTimer > 0) shakeTimer -= dt;
    if (flashTimer > 0) flashTimer -= dt;
    gameTime += dt;
    // Vuorokausi etenee (kiertää 0..1)
    timeOfDay = (timeOfDay + dt / DAY_LENGTH) % 1;
  }

  // Päivitä säähiukkaset (sade/lumi) ruutukoordinaatistossa
  function updateWeather(dt) {
    for (const p of weatherParticles) {
      if (weather === 'rain') {
        p.y += p.sp * dt;
        p.x -= p.sp * 0.18 * dt;
        if (p.y > viewport.height) { p.y = -10; p.x = Math.random() * viewport.width; }
        if (p.x < 0) p.x += viewport.width;
      } else if (weather === 'snow') {
        p.drift += dt;
        p.y += p.sp * dt;
        p.x += Math.sin(p.drift) * 22 * dt;
        if (p.y > viewport.height) { p.y = -5; p.x = Math.random() * viewport.width; }
        if (p.x < 0) p.x += viewport.width; else if (p.x > viewport.width) p.x -= viewport.width;
      }
    }
  }

  // Yhteinen apu: kerää luut (ja aarrekartta) huskyn ympäriltä
  function collectBones(dt) {
    for (const c of collectibles) {
      if (c.collected) continue;
      if (Math.hypot(husky.x - c.x, husky.y - c.y) < husky.radius + c.radius) {
        c.collected = true;
        if (c.map) {
          // ~30 % kartoista on aarreketju (2–3 vihjettä, lopussa legenda)
          const steps = Math.random() < 0.3 ? 2 + Math.floor(Math.random() * 2) : 1;
          revealDigSpot(steps);
          spawnBurst(c.x, c.y, ['#e8d8a0', '#fff', '#c8a060'], 14);
          Audio.play('map');
        } else {
          huskyXp += c.gold ? 6 : 2;
          spawnBurst(c.x, c.y,
            c.gold ? ['#ffe680', '#ffd24a', '#fff'] : ['#fff', '#e8e0d0'],
            c.gold ? 18 : 10);
          Audio.play(c.gold ? 'goldbone' : 'bone');
          updateXpBar();
        }
      }
    }
    collectibles = collectibles.filter((c) => !c.collected);
  }

  // --- Aarrejahti: kartta merkitsee kaivuupaikan, jonka päältä kaivaa jalokiven ---
  const GEMS = [
    { name: 'Rubiini', emoji: '💎', color: '#ff4a6a', xp: 10 },
    { name: 'Smaragdi', emoji: '💚', color: '#3ad48a', xp: 10 },
    { name: 'Safiiri', emoji: '💙', color: '#4a9aff', xp: 10 },
    { name: 'Timantti', emoji: '💠', color: '#bfeaff', xp: 16 },
  ];

  // --- Muinaisesineet: harvinaisia reliikkejä, jotka avaavat pysyvän erikoiskyvyn ---
  const ARTIFACTS = [
    { id: 'feather', name: 'Tuulensulka', emoji: '🪶', desc: '+25 % nopeus',
      apply: (p) => { p.speedMul *= 1.25; } },
    { id: 'crystal', name: 'Näkijän kristalli', emoji: '🔮', desc: 'Pedot huomaavat sinut paljon lähempää',
      apply: (p) => { p.detectionMul *= 0.7; } },
    { id: 'amulet', name: 'Kuun amuletti', emoji: '🌙', desc: 'Voimakas ulvonta',
      apply: (p) => { p.hasHowl = true; p.howlPower += 2; } },
    { id: 'shield', name: 'Muinainen kilpi', emoji: '🛡️', desc: 'Torjuu yhden osuman, latautuu uudelleen',
      apply: (p) => { p.hasShield = true; } },
  ];

  // Myönnä satunnainen vielä hankkimaton artefakti. Palauttaa true jos jokin myönnettiin.
  function grantArtifact(x, y) {
    const available = ARTIFACTS.filter((a) => !artifactsOwned.includes(a.id));
    if (available.length === 0) return false;
    const art = available[Math.floor(Math.random() * available.length)];
    art.apply(perks);
    artifactsOwned.push(art.id);
    if (art.id === 'shield') { husky.shieldReady = true; husky.shieldCd = 0; }
    spawnBurst(x, y, ['#ffd24a', '#bf9bff', '#fff', '#7ad0ff'], 36);
    shakeTimer = Math.max(shakeTimer, 0.25);
    showBanner(`${art.emoji} MUINAISESINE: ${art.name}! ${art.desc}`);
    Audio.play('artifact');
    renderPerks();
    updateHud();
    return true;
  }

  // Arvo kaivuupaikan sijainti: kauas huskysta, pois rakennuksista ja muista paikoista
  function randomDigPos() {
    for (let attempt = 0; attempt < 40; attempt++) {
      const p = randomPos(90);
      if (Math.hypot(p.x - husky.x, p.y - husky.y) < 250) continue;
      if (structures.some((s) => Math.hypot(p.x - s.x, p.y - s.y) < 120)) continue;
      if (digSpots.some((d) => Math.hypot(p.x - d.x, p.y - d.y) < 170)) continue;
      return p;
    }
    return randomPos(90);
  }

  // Paljasta kaivuupaikka. steps>1 = aarreketju (joka kaivu paljastaa seuraavan, lopussa legenda)
  function revealDigSpot(steps = 1) {
    const p = randomDigPos();
    digSpots.push({ x: p.x, y: p.y, progress: 0, step: 1, totalSteps: steps });
    showBanner(steps > 1 ? `🗺️ Aarreketju alkoi! Vihje 1/${steps}` : '📜 Aarrekartta! Etsi ❌ ja kaiva');
  }

  // Kaivaminen: kun husky seisoo ❌:n päällä, edistyminen kasvaa. Tukee useita paikkoja & ketjuja.
  function updateDigging(dt) {
    let done = null;
    for (const d of digSpots) {
      if (Math.hypot(husky.x - d.x, husky.y - d.y) < DIG_RADIUS) {
        d.progress += dt;
        if (Math.random() < 0.4) {
          spawnBurst(d.x + (Math.random() - 0.5) * 20, d.y + 10, ['#6b4a2a', '#4a3018', '#8a6038'], 2);
        }
        if (d.progress % 0.5 < dt) Audio.play('dig');
        if (d.progress >= DIG_TIME) { done = d; break; }
      }
    }
    if (!done) return;
    digSpots = digSpots.filter((d) => d !== done);

    if (done.step < done.totalSteps) {
      // Ketju jatkuu: pieni palkkio + seuraava vihje uuteen paikkaan
      huskyXp += 4;
      spawnBurst(done.x, done.y, ['#e8d8a0', '#fff', '#c8a060'], 16);
      showBanner(`🔎 Vihje ${done.step}/${done.totalSteps} kaivettu — seuraava ❌ ilmestyi!`);
      Audio.play('clue');
      const p = randomDigPos();
      digSpots.push({ x: p.x, y: p.y, progress: 0, step: done.step + 1, totalSteps: done.totalSteps });
      updateXpBar();
    } else if (done.totalSteps > 1) {
      // Ketjun pää: LEGENDAARINEN aarre, joka kätkee muinaisesineen (jos jäljellä)
      gemsFound++;
      huskyXp += 30;
      maxLives++; lives++;
      spawnBurst(done.x, done.y, ['#ffd24a', '#fff', '#ff4a6a', '#4a9aff', '#3ad48a'], 44);
      shakeTimer = 0.3;
      Audio.play('legendary');
      updateHud();
      updateXpBar();
      // Artefakti näyttää oman bannerinsa; muuten näytä legendabanneri
      if (!grantArtifact(done.x, done.y)) {
        showBanner('👑 LEGENDAARINEN AARRE! +30 XP & ❤️');
      }
    } else {
      // Tavallinen jalokivi (pieni mahdollisuus muinaisesineeseen)
      const gem = GEMS[Math.floor(Math.random() * GEMS.length)];
      gemsFound++;
      huskyXp += gem.xp;
      spawnBurst(done.x, done.y, [gem.color, '#fff', '#ffe070'], 26);
      Audio.play('gem');
      updateHud();
      updateXpBar();
      if (Math.random() < 0.1 && grantArtifact(done.x, done.y)) {
        // artefakti löytyi & näytti bannerin
      } else {
        showBanner(`${gem.emoji} ${gem.name} löytyi! +${gem.xp} XP`);
      }
    }
  }

  function update(dt) {
    if (scene === 'interior') { updateInterior(dt); return; }
    updateField(dt);
  }

  // Sisätila: aarrehuone (talot turvallisia, kolot voivat sisältää ansoja)
  function updateInterior(dt) {
    const dir = Input.getDirection();
    husky.update(dt, dir, interior.world, interior.walls, perks, Input.isSprinting());
    Input.consumeHowl(); // kuluta painallus ettei laukea heti ulkona
    updateEffects(dt);
    collectBones(dt);
    Audio.setTension(0);
    if (invulnTimer > 0) invulnTimer -= dt;

    // Ystävällinen NPC: auttaa kerran (paranna jos vahinkoa, muuten luita)
    const npc = interior.npc;
    if (npc && !npc.helped &&
        Math.hypot(husky.x - npc.x, husky.y - npc.y) < husky.radius + npc.radius + 6) {
      npc.helped = true;
      interior.struct.npcHelped = true;
      spawnBurst(npc.x, npc.y, ['#ff9ab0', '#fff', '#aef0ae'], 16);
      Audio.play('goldbone');
      if (lives < maxLives) {
        lives++;
        showBanner('🐰 Ystävä auttoi! +1 ❤️');
      } else {
        huskyXp += 5;
        updateXpBar();
        showBanner('🐰 Ystävä antoi luita!');
      }
      updateHud();
    }

    // Ansat: piikit satuttavat (kolot)
    if (invulnTimer <= 0) {
      for (const tr of interior.traps) {
        if (Math.hypot(husky.x - tr.x, husky.y - tr.y) < husky.radius + tr.radius * 0.55) {
          if (hurtHusky(tr.x, tr.y)) { gameOver(); return; }
          break;
        }
      }
    }

    // Huskyn taso voi nousta luita keräämällä sisälläkin
    if (huskyXp >= xpToNext) { offerSkill(); if (!running) return; }

    // Uloskäynti (ovi)
    const ex = interior.exit;
    if (Math.hypot(husky.x - ex.x, husky.y - ex.y) < husky.radius + ex.r) {
      exitInterior();
    }
  }

  function updateField(dt) {
    const dir = Input.getDirection();
    husky.update(dt, dir, world, obstacles, perks, Input.isSprinting());

    // Rakennukseen meno: jos husky osuu rakennuksen sisäänkäyntiin
    for (const s of structures) {
      if (Math.hypot(husky.x - s.x, husky.y - s.y) < husky.radius + s.radius * 0.7) {
        enterStructure(s);
        return; // kohtaus vaihtui
      }
    }

    // Ulvonta: pelästytä lähellä olevat pedot (jos taito opittu & jäähtynyt)
    const howlPressed = Input.consumeHowl();
    if (perks.hasHowl && howlPressed && husky.howlCd <= 0) {
      const radius = 170 + perks.howlPower * 55;
      const duration = 2.5 + perks.howlPower * 0.6;
      husky.howlMax = Math.max(2.5, 6 - perks.howlPower * 1.0);
      husky.howlCd = husky.howlMax;
      for (const pred of predators) {
        if (Math.hypot(pred.x - husky.x, pred.y - husky.y) < radius) pred.scare(duration);
      }
      howlRings.push({ x: husky.x, y: husky.y, t: 0, maxR: radius });
      Audio.play('howl');
    }
    // Päivitä ulvonta-aaltojen animaatio
    for (const r of howlRings) r.t += dt;
    howlRings = howlRings.filter((r) => r.t < 0.6);

    updateEffects(dt);
    updateWeather(dt);
    updateDigging(dt); // kaivaminen ❌:n päällä

    // Saaliit
    for (const p of prey) {
      if (!p.alive) continue;
      p.update(dt, husky, world, perks);
      // Nappausetäisyyttä kasvattaa Saalistaja-taito (perks.catchBonus)
      const reach = husky.radius + p.radius + perks.catchBonus;
      if (Math.hypot(husky.x - p.x, husky.y - p.y) < reach) {
        p.alive = false;
        score++;
        caughtThisLevel++;
        huskyXp++;
        spawnBurst(p.x, p.y, ['#fff', '#ffe8c0', '#d8c4a0'], 12); // nappauspurske
        Audio.play('catch');
        updateHud();
        updateXpBar();
      }
    }
    prey = prey.filter((p) => p.alive);

    collectBones(dt);

    // Husky nousi tasolle → tarjoa taito (pysäyttää pelin)
    if (huskyXp >= xpToNext) {
      offerSkill();
      if (!running) return;
    }

    // Tason läpäisy?
    if (caughtThisLevel >= goal) {
      nextLevel();
      return; // kenttä vaihtui — jatketaan seuraavalla framella
    }
    refillPrey();

    // Pedot
    if (invulnTimer > 0) invulnTimer -= dt;
    const envMul = envDetectMul(); // yö/sää heikentää petojen näköä
    let chasers = 0;
    for (const pred of predators) {
      pred.update(dt, husky, world, obstacles, perks, envMul);

      // Jännitysmusiikki: jahtaavat (ja syöksyvät pomot) nostavat tasoa
      if (pred.state === 'chase' || (pred.isBoss && pred.chargeState !== 'none')) chasers++;

      // Syöksyvaroitus-ääni kun pomo aloittaa latauksen
      if (pred.isBoss) {
        if (pred.chargeState === 'windup' && !pred._chargeSfx) {
          Audio.play('charge');
          pred._chargeSfx = true;
        } else if (pred.chargeState !== 'windup') {
          pred._chargeSfx = false;
        }
      }

      if (invulnTimer <= 0 && collides(husky, pred)) {
        if (hurtHusky(pred.x, pred.y)) { gameOver(); return; }
      }
    }
    Audio.setTension(chasers > 0 ? Math.min(1, chasers * 0.5) : 0);
  }

  // Kevyt ruudukko aktiivisen maailman koon mukaan
  function drawGrid(w, color) {
    ctx.strokeStyle = color || 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w.width; x += 64) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, w.height); ctx.stroke();
    }
    for (let y = 0; y < w.height; y += 64) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w.width, y); ctx.stroke();
    }
  }

  function drawCollectibles() {
    for (const c of collectibles) {
      const bob = Math.sin(gameTime * 3 + c.phase) * 3;
      if (c.map) {
        // Aarrekartta (kääröpaperi pienellä punaisella X:llä)
        ctx.save();
        ctx.translate(c.x, c.y + bob);
        ctx.fillStyle = '#e8d8a8';
        ctx.strokeStyle = '#b89a64';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.rect(-c.radius, -c.radius * 0.7, c.radius * 2, c.radius * 1.4);
        ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#c0463a';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-4, -4); ctx.lineTo(4, 4); ctx.moveTo(4, -4); ctx.lineTo(-4, 4);
        ctx.stroke();
        ctx.restore();
      } else {
        Sprites.drawBone(ctx, c.x, c.y, c.radius, c.gold, bob);
      }
    }
  }

  // Aarrekarttojen kaivuupaikat + kaivuuedistymä (tukee useita & ketjuja)
  function drawDigSpots() {
    const pulse = 0.5 + 0.5 * Math.abs(Math.sin(gameTime * 4));
    for (const d of digSpots) {
      const chain = d.totalSteps > 1;
      // Multaläiskä
      ctx.fillStyle = 'rgba(70,48,28,0.55)';
      ctx.beginPath();
      ctx.arc(d.x, d.y, DIG_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      // X (ketjuvihje sinertävä, tavallinen punainen)
      ctx.strokeStyle = chain
        ? `rgba(90,150,255,${0.6 + pulse * 0.4})`
        : `rgba(220,60,50,${0.6 + pulse * 0.4})`;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      const r = DIG_RADIUS * 0.55;
      ctx.beginPath();
      ctx.moveTo(d.x - r, d.y - r); ctx.lineTo(d.x + r, d.y + r);
      ctx.moveTo(d.x + r, d.y - r); ctx.lineTo(d.x - r, d.y + r);
      ctx.stroke();
      // Kaivuuedistymä-rengas
      if (d.progress > 0) {
        ctx.strokeStyle = '#ffe070';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(d.x, d.y, DIG_RADIUS + 6,
          -Math.PI / 2, -Math.PI / 2 + (d.progress / DIG_TIME) * Math.PI * 2);
        ctx.stroke();
      }
      // Ketjun vihjenumero
      if (chain) {
        ctx.fillStyle = '#bfe0ff';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${d.step}/${d.totalSteps}`, d.x, d.y - DIG_RADIUS - 12);
      }
    }
  }

  function drawHusky() {
    // Muinaisen kilven kehä huskyn ympärillä (kun valmiina)
    if (perks.hasShield && husky.shieldReady) {
      const pulse = 0.5 + 0.5 * Math.abs(Math.sin(gameTime * 3));
      ctx.strokeStyle = `rgba(120,200,255,${0.4 + pulse * 0.4})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(husky.x, husky.y, husky.radius + 7, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Husky vilkkuu suoja-aikana
    if (invulnTimer <= 0 || Math.floor(invulnTimer * 10) % 2 === 0) {
      husky.draw(ctx);
    }
  }

  // Talo (🏠) tai kolo (🕳️) sisäänkäynteineen + "mene sisään" -vihje
  function drawStructure(s) {
    ctx.save();
    ctx.translate(s.x, s.y);
    const r = s.radius;
    if (s.kind === 'house') {
      ctx.fillStyle = '#b06a4a';
      ctx.fillRect(-r, -r * 0.4, r * 2, r * 1.4);           // seinä
      ctx.fillStyle = '#7a3f2a';
      ctx.beginPath();                                       // katto
      ctx.moveTo(-r * 1.18, -r * 0.4);
      ctx.lineTo(0, -r * 1.25);
      ctx.lineTo(r * 1.18, -r * 0.4);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#3a2418';
      ctx.fillRect(-r * 0.32, r * 0.2, r * 0.64, r * 0.8);   // ovi
      ctx.fillStyle = '#f0d060';
      ctx.fillRect(r * 0.45, -r * 0.1, r * 0.35, r * 0.35);  // ikkuna
    } else {
      ctx.fillStyle = '#3a2e22';
      ctx.beginPath(); ctx.ellipse(0, r * 0.3, r * 1.15, r * 0.75, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#120d08';
      ctx.beginPath(); ctx.ellipse(0, r * 0.38, r * 0.72, r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    // Tunnus + vihje
    const near = Math.hypot(husky.x - s.x, husky.y - s.y) < s.radius + 80;
    ctx.font = 'bold 26px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(s.kind === 'house' ? '🏠' : '🕳️', s.x, s.y - s.radius - 18);
    if (near) {
      ctx.fillStyle = '#ffe070';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText('Mene sisään', s.x, s.y - s.radius - 40);
    }
  }

  function drawField() {
    // Tausta + ruudukko (biomin värit)
    ctx.fillStyle = biome.ground;
    ctx.fillRect(-40, -40, world.width + 80, world.height + 80);
    drawGrid(world, biome.grid);

    for (const pred of predators) pred.drawVision(ctx);
    drawDigSpots(); // maahan, hahmojen alle
    for (const s of structures) drawStructure(s);
    for (const o of obstacles) if (o.type === 'rock') o.draw(ctx, biome);
    drawCollectibles();
    for (const p of prey) p.draw(ctx);

    for (const pred of predators) {
      // Syöksyn telegraph: latauksen aikana sykkivä punainen varoitusviiva
      if (pred.isBoss && pred.chargeState === 'windup') {
        const pulse = 0.4 + 0.5 * Math.abs(Math.sin(gameTime * 12));
        const len = 360;
        ctx.save();
        ctx.translate(pred.x, pred.y);
        ctx.rotate(Math.atan2(pred.chargeDir.y, pred.chargeDir.x));
        const g = ctx.createLinearGradient(0, 0, len, 0);
        g.addColorStop(0, `rgba(255,40,30,${pulse})`);
        g.addColorStop(1, 'rgba(255,40,30,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, -10, len, 20);
        ctx.fillStyle = `rgba(255,60,40,${pulse})`;
        ctx.beginPath();
        ctx.moveTo(len, -22);
        ctx.lineTo(len + 26, 0);
        ctx.lineTo(len, 22);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      pred.draw(ctx);

      // Pomolle kruunu ja punainen kehä (toipuessa himmeämpi = haavoittuvampi)
      if (pred.isBoss) {
        ctx.strokeStyle = pred.chargeState === 'recover'
          ? 'rgba(120,180,255,0.6)' : 'rgba(255,70,60,0.5)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(pred.x, pred.y, pred.radius + 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.font = `${pred.radius}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('👑', pred.x, pred.y - pred.radius - 6);
      }
    }

    drawHusky();

    // Pusikot huskyn päälle, jotta piiloutuminen näkyy visuaalisesti
    for (const o of obstacles) if (o.type === 'bush') o.draw(ctx, biome);

    // Ulvonta-aallot (laajenevat renkaat)
    for (const r of howlRings) {
      const p = r.t / 0.6;
      ctx.strokeStyle = `rgba(180,210,255,${(1 - p) * 0.8})`;
      ctx.lineWidth = 4 * (1 - p) + 1;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.maxR * p, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawInterior() {
    const iw = interior.world;
    // Tumma reunus koko näkymään (sisätila on viewporttia pienempi)
    ctx.fillStyle = '#0e0b08';
    ctx.fillRect(cam.x - 10, cam.y - 10, viewport.width + 20, viewport.height + 20);
    // Lattia
    ctx.fillStyle = interior.kind === 'house' ? '#5a4636' : '#332a20';
    ctx.fillRect(0, 0, iw.width, iw.height);
    drawGrid(iw);
    // Seinäkehys
    ctx.strokeStyle = '#241a12';
    ctx.lineWidth = 16;
    ctx.strokeRect(8, 8, iw.width - 16, iw.height - 16);
    for (const o of interior.walls) o.draw(ctx);

    // Ansat (piikit)
    for (const tr of interior.traps) {
      ctx.fillStyle = 'rgba(60,40,30,0.7)';
      ctx.beginPath();
      ctx.arc(tr.x, tr.y, tr.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#cfd2d8';
      ctx.strokeStyle = '#8a8e96';
      ctx.lineWidth = 1;
      const n = 7;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const bx = tr.x + Math.cos(a) * tr.radius * 0.5;
        const by = tr.y + Math.sin(a) * tr.radius * 0.5;
        ctx.beginPath();
        ctx.moveTo(bx - 4, by + 5);
        ctx.lineTo(bx, by - 8);
        ctx.lineTo(bx + 4, by + 5);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
      }
    }

    drawCollectibles();

    // Ystävällinen NPC + sydän-ilmaisin
    const npc = interior.npc;
    if (npc && !npc.helped) {
      Sprites.draw(ctx, npc);
      ctx.fillStyle = '#ff7a9a';
      ctx.font = 'bold 18px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('💛', npc.x, npc.y - npc.radius - 14);
    }

    // Ovi (uloskäynti)
    const ex = interior.exit;
    ctx.fillStyle = '#8a6a3a';
    ctx.fillRect(ex.x - ex.r, ex.y - 8, ex.r * 2, 34);
    ctx.fillStyle = '#ffe070';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⬇ Ulos', ex.x, ex.y - 18);
    drawHusky();
  }

  function draw() {
    const w = activeWorld();
    ctx.save();
    // Ruudun tärinä osuman jälkeen
    if (shakeTimer > 0) {
      const mag = shakeTimer * 22;
      ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
    }
    // Kamera seuraa huskya
    updateCamera();
    ctx.translate(-Math.round(cam.x), -Math.round(cam.y));

    if (scene === 'interior') drawInterior();
    else drawField();

    // Pinottavat mittarit huskyn yllä
    let barY = husky.y - husky.radius - 24;

    // Sprint-energiapalkki (vain jos Kirmaus opittu)
    if (perks.hasSprint) {
      const w = 38, x = husky.x - w / 2;
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(x, barY, w, 5);
      ctx.fillStyle = husky.sprinting ? '#ffd24a' : (husky.stamina > 0.25 ? '#7ad0ff' : '#ff8c5a');
      ctx.fillRect(x, barY, w * husky.stamina, 5);
      barY -= 8;
    }

    // Ulvonnan jäähdytysmittari (vain jos Ulvonta opittu)
    if (perks.hasHowl) {
      const w = 38, x = husky.x - w / 2;
      const ready = husky.howlCd <= 0;
      const fill = ready ? 1 : 1 - husky.howlCd / husky.howlMax;
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(x, barY, w, 5);
      ctx.fillStyle = ready ? '#c79cff' : '#6a5a8a';
      ctx.fillRect(x, barY, w * fill, 5);
    }

    // "Piilossa"-ilmaisin huskyn yllä
    if (husky.hidden) {
      ctx.fillStyle = '#aef0ae';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🤫 Piilossa', husky.x, husky.y - husky.radius - 14);
    }

    // Hiukkaset (nappauspurske, osumaroiske) ylimmäs
    for (const pt of particles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, pt.life / pt.maxLife));
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.restore(); // lopeta kamera- ja tärinä-translaatio

    // Vuorokausi & sää (ruutukoordinaatistossa, vain ulkona)
    if (scene === 'field') {
      drawNightOverlay();
      drawWeather();
      drawMinimap();
    }

    // Punainen osumavälähdys (ruutukoordinaatistossa, ei tärise eikä kameroi)
    if (flashTimer > 0) {
      ctx.fillStyle = `rgba(255,40,30,${(flashTimer / 0.4) * 0.35})`;
      ctx.fillRect(0, 0, viewport.width, viewport.height);
    }
  }

  // Vuorokauden tummennus + aamun/illan lämmin hehku (ruutukoordinaatisto)
  function drawNightOverlay() {
    const light = envLight();
    const darkness = 1 - light;
    if (darkness > 0.03) {
      ctx.fillStyle = `rgba(18,26,58,${darkness * 0.5})`;
      ctx.fillRect(0, 0, viewport.width, viewport.height);
    }
    // Aamun-/illankoiton lämmin sävy (voimakkain kun valo on matala mutta ei keskiyö)
    const glow = Math.max(0, 1 - Math.abs(light - 0.3) / 0.3);
    if (glow > 0.02) {
      ctx.fillStyle = `rgba(255,150,70,${glow * 0.14})`;
      ctx.fillRect(0, 0, viewport.width, viewport.height);
    }
  }

  // Sää: sadeviivat / lumihiutaleet / sumuverho (ruutukoordinaatisto)
  function drawWeather() {
    if (weather === 'rain') {
      ctx.strokeStyle = 'rgba(175,195,235,0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (const p of weatherParticles) {
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.len * 0.3, p.y + p.len);
      }
      ctx.stroke();
    } else if (weather === 'snow') {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      for (const p of weatherParticles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (weather === 'fog') {
      ctx.fillStyle = 'rgba(200,205,212,0.3)';
      ctx.fillRect(0, 0, viewport.width, viewport.height);
    }
  }

  // Minikartta isoa maailmaa varten: husky, rakennukset, pedot, kulta, näkymä
  function drawMinimap() {
    const mw = 150, mh = Math.round(mw * world.height / world.width); // 150 x 100
    const ox = viewport.width - mw - 12, oy = 52; // oikea yläkulma, HUDin alle
    const sx = mw / world.width, sy = mh / world.height;
    ctx.save();
    // Tausta
    ctx.fillStyle = 'rgba(10,15,10,0.65)';
    ctx.fillRect(ox - 3, oy - 3, mw + 6, mh + 6);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(ox - 3, oy - 3, mw + 6, mh + 6);
    // Rakennukset
    for (const s of structures) {
      ctx.fillStyle = s.kind === 'house' ? '#d8a060' : '#7a5a3a';
      ctx.fillRect(ox + s.x * sx - 2.5, oy + s.y * sy - 2.5, 5, 5);
    }
    // Kultaluut
    for (const c of collectibles) {
      if (!c.gold) continue;
      ctx.fillStyle = '#ffe070';
      ctx.fillRect(ox + c.x * sx - 1, oy + c.y * sy - 1, 2, 2);
    }
    // Pedot
    for (const p of predators) {
      ctx.fillStyle = p.isBoss ? '#ff3030' : '#ff6040';
      ctx.beginPath();
      ctx.arc(ox + p.x * sx, oy + p.y * sy, p.isBoss ? 3 : 2, 0, Math.PI * 2);
      ctx.fill();
    }
    // Kaivuupaikat (❌) — ketjut sinertäviä
    for (const d of digSpots) {
      ctx.strokeStyle = d.totalSteps > 1 ? '#5a9aff' : '#ff5a4a';
      ctx.lineWidth = 1.5;
      const mx = ox + d.x * sx, my = oy + d.y * sy;
      ctx.beginPath();
      ctx.moveTo(mx - 3, my - 3); ctx.lineTo(mx + 3, my + 3);
      ctx.moveTo(mx + 3, my - 3); ctx.lineTo(mx - 3, my + 3);
      ctx.stroke();
    }
    // Näkyvä alue (viewport)
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.strokeRect(ox + cam.x * sx, oy + cam.y * sy, viewport.width * sx, viewport.height * sy);
    // Husky
    ctx.fillStyle = '#7ad0ff';
    ctx.beginPath();
    ctx.arc(ox + husky.x * sx, oy + husky.y * sy, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function loop(time) {
    if (!running) return;
    const dt = Math.max(0, Math.min((time - lastTime) / 1000, 0.05)); // rajaa isot hypyt, ei negatiivinen
    lastTime = time;
    update(dt);
    // Jos update() pysäytti pelin (taidonvalinta / game over), älä ajasta
    // uutta framea — muuten resumeGame loisi toisen rinnakkaisen silmukan.
    if (running) {
      draw();
      requestAnimationFrame(loop);
    }
  }

  function startGame() {
    init();
    overlay.classList.add('hidden');
    Audio.unlock();
    Audio.startMusic();
    showBanner(`${biome.emoji} ${biome.name} ${weatherEmoji()} — Taso 1`);
    running = true;
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  function gameOver() {
    running = false;
    Audio.stopMusic();
    Audio.play('gameover');
    // Päivitä ennätykset
    let newRecord = false;
    if (level > (highScores.bestLevel || 0)) { highScores.bestLevel = level; newRecord = true; }
    if (score > (highScores.bestScore || 0)) { highScores.bestScore = score; newRecord = true; }
    if (huskyLevel > (highScores.bestHuskyLevel || 0)) { highScores.bestHuskyLevel = huskyLevel; newRecord = true; }
    if (gemsFound > (highScores.bestGems || 0)) { highScores.bestGems = gemsFound; newRecord = true; }
    if (artifactsOwned.length > (highScores.bestArtifacts || 0)) { highScores.bestArtifacts = artifactsOwned.length; newRecord = true; }
    if (newRecord) saveHighScores();

    overlayText.textContent =
      `Peli päättyi tasolla ${level}! Husky ehti tasolle ${huskyLevel} ja pyydysti yhteensä ${score} eläintä.`;
    renderHighScores(newRecord);
    startBtn.textContent = 'Pelaa uudelleen';
    overlay.classList.remove('hidden');
  }

  startBtn.addEventListener('click', startGame);

  // Näytä tallennetut ennätykset jo aloitusruudussa
  renderHighScores(false);
})();
