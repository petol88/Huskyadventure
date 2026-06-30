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
  const quitBtn = document.getElementById('quit-btn');
  const tempHud = document.getElementById('temp-hud');
  const tempValue = document.getElementById('temp-value');

  // Jalokivikaupan käyttöliittymä
  const shopOverlay = document.getElementById('shop-overlay');
  const shopGemCount = document.getElementById('shop-gem-count');
  const shopSkinsList = document.getElementById('shop-skins-list');
  const shopItemsList = document.getElementById('shop-items-list');
  const shopHatsList = document.getElementById('shop-hats-list');
  const shopCloseBtn = document.getElementById('shop-close-btn');
  const shopBtnOpen = document.getElementById('shop-btn-open');

  // Bestiariumin käyttöliittymä
  const codexOverlay = document.getElementById('codex-overlay');
  const codexGrid = document.getElementById('codex-grid');
  const codexCloseBtn = document.getElementById('codex-close-btn');
  const codexBtnOpen = document.getElementById('codex-btn-open');

  // Mökin käyttöliittymä
  const cabinOverlay = document.getElementById('cabin-overlay');
  const cabinGrid = document.getElementById('cabin-upgrades-list');
  const cabinCloseBtn = document.getElementById('cabin-close-btn');
  const cabinGemCount = document.getElementById('cabin-gem-count');

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
      prey: ['rabbit', 'mouse', 'squirrel', 'hedgehog', 'bird', 'deer'] },
    { id: 'snow', name: 'Lumiaava', emoji: '❄️', ground: '#c2cedd', grid: 'rgba(90,110,140,0.10)',
      rockFill: '#9fb3c8', rockStroke: '#7c93ad', bushFill: '#eaf2fa', bushEmoji: '🌲',
      prey: ['rabbit', 'mouse', 'hedgehog', 'bird', 'deer'] },
    { id: 'desert', name: 'Aavikko', emoji: '🏜️', ground: '#d8c088', grid: 'rgba(120,90,40,0.08)',
      rockFill: '#b89a64', rockStroke: '#947a4c', bushFill: '#7e8b3a', bushEmoji: '🌵',
      prey: ['mouse', 'squirrel', 'bird', 'hedgehog'] },
    { id: 'swamp', name: 'Suo', emoji: '🌿', ground: '#2c3a2c', grid: 'rgba(130,170,130,0.06)',
      rockFill: '#5a6450', rockStroke: '#3e463a', bushFill: '#3a5a3a', bushEmoji: '🌿',
      prey: ['rabbit', 'mouse', 'squirrel', 'hedgehog', 'bird', 'beaver'] },
    { id: 'volcano', name: 'Tulivuorimaa', emoji: '🌋', ground: '#281816', grid: 'rgba(255,90,40,0.06)',
      rockFill: '#5a4642', rockStroke: '#3c2b29', bushFill: '#42241e', bushEmoji: '🔥',
      prey: ['rabbit', 'mouse', 'squirrel', 'bird'] },
    { id: 'river', name: 'Jokivarsi', emoji: '🌊', ground: '#2a4a2a', grid: 'rgba(100,180,100,0.06)',
      rockFill: '#5a7a5a', rockStroke: '#3a5a3a', bushFill: '#2e6e2e', bushEmoji: '🌿',
      prey: ['rabbit', 'mouse', 'squirrel', 'bird', 'beaver', 'deer'] },
    { id: 'jungle', name: 'Viidakko', emoji: '🌴', ground: '#124424', grid: 'rgba(255,255,255,0.04)',
      rockFill: '#4e563d', rockStroke: '#2d3320', bushFill: '#008a20', bushEmoji: '🌴',
      prey: ['rabbit', 'mouse', 'bird', 'monkey'] },
    { id: 'foggy_peaks', name: 'Sumuvuoret', emoji: '⛰️', ground: '#5e6b75', grid: 'rgba(255,255,255,0.03)',
      rockFill: '#7a8c99', rockStroke: '#586772', bushFill: '#414e59', bushEmoji: '🌲',
      prey: ['rabbit', 'bird', 'mountain_goat'] },
  ];
  function biomeForLevel(lv) { return BIOMES[(lv - 1) % BIOMES.length]; }
  let biome = BIOMES[0];

  function getSeasonForLevel(lv) {
    const index = Math.floor((lv - 1) / 2) % 4;
    return ['spring', 'summer', 'autumn', 'winter'][index];
  }
  function seasonName(s) {
    return { spring: 'Kevät 🌱', summer: 'Kesä ☀️', autumn: 'Syksy 🍂', winter: 'Talvi ❄️' }[s] || s;
  }

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
    else if (weather === 'fog') m *= (biome.id === 'foggy_peaks' ? 0.35 : 0.7);
    else if (weather === 'snow') m *= 0.92;
    else if (weather === 'blizzard') m *= 0.55; // Lumimyrsky heikentää näköä rajusti
    else if (weather === 'sandstorm') m *= 0.62; // Hiekkamyrsky hämärtää
    return m;
  }

  function isNightTime() {
    return timeOfDay > 0.76 || timeOfDay < 0.22;
  }

  function pickWeather(biomeId) {
    const r = Math.random();
    if (biomeId === 'desert') return r < 0.55 ? 'clear' : r < 0.82 ? 'sandstorm' : r < 0.94 ? 'fog' : 'rain';
    if (biomeId === 'snow') return r < 0.35 ? 'snow' : r < 0.62 ? 'blizzard' : r < 0.82 ? 'clear' : r < 0.94 ? 'fog' : 'rain';
    if (biomeId === 'swamp') return r < 0.4 ? 'fog' : r < 0.7 ? 'rain' : r < 0.9 ? 'clear' : 'snow';
    if (biomeId === 'volcano') return r < 0.65 ? 'ash' : r < 0.9 ? 'clear' : 'fog';
    if (biomeId === 'jungle') return r < 0.58 ? 'rain' : r < 0.85 ? 'clear' : 'fog';
    if (biomeId === 'foggy_peaks') return r < 0.82 ? 'fog' : 'rain';
    return r < 0.5 ? 'clear' : r < 0.75 ? 'rain' : r < 0.9 ? 'fog' : 'snow';
  }

  function initWeatherParticles() {
    weatherParticles = [];
    icicles = [];
    icicleTimer = 0;
    sandstormPush = { x: 0, y: 0 };
    sandstormTimer = 0;
    weatherHazardBannerCd = 0;
    if (weather === 'rain') {
      for (let i = 0; i < 150; i++) weatherParticles.push({
        x: Math.random() * viewport.width, y: Math.random() * viewport.height,
        len: 9 + Math.random() * 12, sp: 650 + Math.random() * 350 });
    } else if (weather === 'snow') {
      for (let i = 0; i < 90; i++) weatherParticles.push({
        x: Math.random() * viewport.width, y: Math.random() * viewport.height,
        r: 1.5 + Math.random() * 2.5, sp: 40 + Math.random() * 45, drift: Math.random() * Math.PI * 2 });
    } else if (weather === 'blizzard') {
      // Lumimyrsky: tiheä lumi + vahva tuuli
      for (let i = 0; i < 200; i++) weatherParticles.push({
        x: Math.random() * viewport.width, y: Math.random() * viewport.height,
        r: 1.0 + Math.random() * 3.5, sp: 130 + Math.random() * 200,
        drift: Math.random() * Math.PI * 2, windX: 260 + Math.random() * 100 });
    } else if (weather === 'ash') {
      for (let i = 0; i < 80; i++) weatherParticles.push({
        x: Math.random() * viewport.width, y: Math.random() * viewport.height,
        r: 1.0 + Math.random() * 2.2, sp: 30 + Math.random() * 35, drift: Math.random() * Math.PI * 2 });
    } else if (weather === 'sandstorm') {
      // Hiekkamyrsky: vaakahiukkaset, nopeita
      for (let i = 0; i < 180; i++) weatherParticles.push({
        x: Math.random() * viewport.width, y: Math.random() * viewport.height,
        r: 1.5 + Math.random() * 3, sp: 320 + Math.random() * 280,
        drift: Math.random() * Math.PI * 2, alpha: 0.3 + Math.random() * 0.5 });
      // Hiekkamyrskyn alkusuunta
      const ang = Math.random() * Math.PI * 2;
      sandstormPush.x = Math.cos(ang);
      sandstormPush.y = Math.sin(ang);
    }
  }

  function weatherEmoji() {
    if (weather === 'rain') return '🌧️';
    if (weather === 'snow') return '🌨️';
    if (weather === 'fog') return '🌫️';
    if (weather === 'ash') return '🌋';
    if (weather === 'blizzard') return '🌪️';
    if (weather === 'sandstorm') return '🏜️🌪️';
    return '☀️';
  }

  let husky, prey, predators, obstacles, companion = null;
  let lostPuppy = null;        // Eksynyt huskypentu (pelastustehtävä)
  let tookDamageThisLevel = false; // Seurataan tasokohtaista vahinkoa saavutuksia varten
  let projectiles = []; // Kaikki ammutut projektilit (tulipallot, lumipallot, pistimet)
  let volcanoTimer = 0;        // Ajastin magmakivien luonnille
  let fireplaceHealTimer = 0;  // Mökin tulisijan parannusajastin
  let interiorExitCooldown = 0; // Estää heti ulos tulemisen sisään mentäessä
  let bodyTemp = 50;           // Huskyn ruumiinlämpö (0-100)
  let freezeDmgTimer = 0;      // Ajastin jäätymisvahingolle
  let currentSeason = 'spring'; // Nykyinen vuodenaika
  let icicles = [];             // Jääpuikot (Lumiaapa, blizzard)
  let icicleTimer = 0;          // Ajastin jääpuikolle
  let sandstormPush = { x: 0, y: 0 }; // Hiekkamyrskyn tuulen suunta (normalisoitu)
  let sandstormTimer = 0;       // Hiekkamyrskyn tuulisuunnanvaihtaja
  let weatherHazardBannerCd = 0; // Jottei varoitusbanneri spämmää
  // --- Combo-järjestelmä ---
  let comboCount = 0;           // Peräkkäiset nappaukset
  let comboMul = 1;             // Pistekerroin (1x, 2x, 3x)
  let comboTimer = 0;           // Aika ennen combotauon nollausta
  const COMBO_TIMEOUT = 4.5;    // Sekuntia ennen combopoistumistra
  // --- Kenttätapahtumat ---
  let fieldEvent = null;        // Aktiivinen kenttätapahtuma { type, x, y, timer, ... }
  let fieldEventTimer = 0;      // Aiassin seuraavalle tapahtumalle
  // --- Jalanjäljet ---
  let footprints = [];          // [{ x, y, age, maxAge, kind }]
  let footprintTimer = 0;       // Ajastin
  // --- Kalaveden kalastus ---
  let fishingSpots = [];        // { x, y, radius, rechargeCd }
  let fishingProgress = 0;      // Kaivamista vastaava edistymä
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

  window.onBossDamage = function(boss, source) {
    let msg = '';
    if (source === 'lava') {
      msg = `🔥 Pomo ohjattiin laavaan! HP: ${boss.hp}/${boss.maxHp}`;
      spawnBurst(boss.x, boss.y, ['#ff5a00', '#ffc000', '#ff0000'], 34);
    } else {
      msg = `💥 Pomo törmäsi esteeseen! HP: ${boss.hp}/${boss.maxHp}`;
      spawnBurst(boss.x, boss.y, ['#ff9000', '#ffe8c0', '#777777'], 30);
    }
    
    if (boss.hp <= 0) {
      spawnBurst(boss.x, boss.y, ['#ffd700', '#ffffff', '#ffaa00'], 48);
      Audio.play('legendary');
      shopData.totalGems += 15;
      saveShopData();
      showBanner('👑 KUKISTIT POMON! +15 💎');
      nextLevel();
    } else {
      showBanner(msg);
      Audio.play('hurt');
    }
  };

  // --- Jalokivikaupan tiedot (localStorage) ---
  const SHOP_KEY = 'huskyAdventures.shopData';
  let shopData = {
    totalGems: 0,
    ownedSkins: ['default'],
    equippedSkin: 'default',
    ownedHats: [],
    equippedHat: 'none',
    discovered: {},
    cabinUpgrades: {
      fireplace: 0,
      trophyWall: false,
      doghouse: 0,
      bowlLvl: 0
    },
    achievements: {
      caughtCount: 0,
      rescuedCount: 0,
      noDamageLevel: false,
      visitedCave: false,
      unlocked: []
    },
    items: {
      heartPotion: 0,
      speedCharm: 0,
      smokeBomb: 0,
      lantern: 0,
      companion: 0
    }
  };

  function loadShopData() {
    try {
      const saved = JSON.parse(localStorage.getItem(SHOP_KEY));
      if (saved) {
        shopData = Object.assign(shopData, saved);
        if (!Array.isArray(shopData.ownedSkins)) shopData.ownedSkins = ['default'];
        if (!Array.isArray(shopData.ownedHats)) shopData.ownedHats = [];
        if (typeof shopData.equippedHat !== 'string') shopData.equippedHat = 'none';
        
        // Varmistetaan, että achievements on oikeanlainen olio
        if (!shopData.achievements || typeof shopData.achievements !== 'object') {
          shopData.achievements = {
            caughtCount: 0,
            rescuedCount: 0,
            noDamageLevel: false,
            visitedCave: false,
            unlocked: []
          };
        } else {
          if (typeof shopData.achievements.caughtCount !== 'number') shopData.achievements.caughtCount = 0;
          if (typeof shopData.achievements.rescuedCount !== 'number') shopData.achievements.rescuedCount = 0;
          if (typeof shopData.achievements.noDamageLevel !== 'boolean') shopData.achievements.noDamageLevel = false;
          if (typeof shopData.achievements.visitedCave !== 'boolean') shopData.achievements.visitedCave = false;
          if (!Array.isArray(shopData.achievements.unlocked)) shopData.achievements.unlocked = [];
        }
        
        // Varmistetaan, että items on oikeanlainen olio
        if (!shopData.items || typeof shopData.items !== 'object') {
          shopData.items = { heartPotion: 0, speedCharm: 0, smokeBomb: 0, lantern: 0, companion: 0 };
        } else {
          const expectedItems = ['heartPotion', 'speedCharm', 'smokeBomb', 'lantern', 'companion'];
          expectedItems.forEach(item => {
            if (typeof shopData.items[item] !== 'number') shopData.items[item] = 0;
          });
        }
        
        // Varmistetaan, että discovered on olemassa
        if (!shopData.discovered || typeof shopData.discovered !== 'object') {
          shopData.discovered = {};
        }

        // Varmistetaan, että cabinUpgrades on olemassa
        if (!shopData.cabinUpgrades || typeof shopData.cabinUpgrades !== 'object') {
          shopData.cabinUpgrades = { fireplace: 0, trophyWall: false, doghouse: 0, bowlLvl: 0 };
        } else {
          if (typeof shopData.cabinUpgrades.fireplace !== 'number') shopData.cabinUpgrades.fireplace = 0;
          if (typeof shopData.cabinUpgrades.trophyWall !== 'boolean') shopData.cabinUpgrades.trophyWall = false;
          if (typeof shopData.cabinUpgrades.doghouse !== 'number') shopData.cabinUpgrades.doghouse = 0;
          if (typeof shopData.cabinUpgrades.bowlLvl !== 'number') shopData.cabinUpgrades.bowlLvl = 0;
        }
      }
    } catch (e) {
      console.error("Error loading shop data, resetting:", e);
    }
  }

  function saveShopData() {
    try {
      localStorage.setItem(SHOP_KEY, JSON.stringify(shopData));
    } catch (e) {}
  }

  loadShopData();

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

    // Asetetaan pusikot ensin
    for (let i = 0; i < bushCount; i++) tryPlace('bush', 38, 55);

    // Biomi-spesifit esteet ja vaarat
    if (biome.id === 'swamp') {
      const mudCount = 3 + Math.floor(Math.random() * 4);
      for (let i = 0; i < mudCount; i++) tryPlace('mud', 35, 50);
      for (let i = 0; i < rockCount; i++) tryPlace('rock', 30, 42);
    } else if (biome.id === 'snow') {
      const iceCount = 3 + Math.floor(Math.random() * 4);
      for (let i = 0; i < iceCount; i++) tryPlace('ice', 35, 52);
      for (let i = 0; i < rockCount; i++) tryPlace('rock', 30, 42);
    } else if (biome.id === 'desert') {
      const cactusCount = 4 + Math.floor(Math.random() * 5);
      for (let i = 0; i < cactusCount; i++) tryPlace('cactus', 22, 28);
      for (let i = 0; i < Math.max(2, rockCount - 4); i++) tryPlace('rock', 30, 42);
    } else if (biome.id === 'volcano') {
      const lavaCount = 4 + Math.floor(Math.random() * 4); // 4-7 laavaläiskää
      for (let i = 0; i < lavaCount; i++) tryPlace('lava', 35, 52);
      for (let i = 0; i < rockCount; i++) tryPlace('rock', 30, 42);
    } else if (biome.id === 'river') {
      const waterCount = 5 + Math.floor(Math.random() * 4);
      for (let i = 0; i < waterCount; i++) tryPlace('water', 38, 55);
      for (let i = 0; i < rockCount; i++) tryPlace('rock', 30, 42);
    } else {
      for (let i = 0; i < rockCount; i++) tryPlace('rock', 30, 42);
    }

    // Kausikohtaiset esteet
    if (currentSeason === 'winter') {
      for (let i = 0; i < 3; i++) tryPlace('campfire', 24, 28);
    } else if (currentSeason === 'autumn') {
      for (let i = 0; i < 6; i++) tryPlace('leafpile', 28, 38);
    }

    return obs;
  }

  // --- Rakennukset: talot (🏠), kolot (🕳️) ja luolat (🪨) joihin voi mennä sisään ---
  function createStructures(lv) {
    const list = [];
    const count = 2 + Math.floor(Math.random() * 2); // 2–3 rakennusta
    for (let i = 0; i < count; i++) {
      for (let attempt = 0; attempt < 40; attempt++) {
        const p = randomPos(140);
        if (Math.hypot(p.x - center.x, p.y - center.y) < 220) continue; // ei keskelle
        if (list.some((s) => Math.hypot(p.x - s.x, p.y - s.y) < 320)) continue; // erilleen
        const kind = Math.random() < 0.35 ? 'house' : Math.random() < 0.6 ? 'den' : 'cave';
        list.push({
          x: p.x, y: p.y, radius: 42, kind, looted: false,
          hasNpc: kind === 'house' && Math.random() < 0.55,
          hasTraps: (kind === 'den' || kind === 'cave') && Math.random() < 0.6,
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
      // Biomin mukainen uniikki pomovastus
      let bossKind = 'bear';
      if (biome.id === 'snow') bossKind = 'yeti';
      else if (biome.id === 'desert') bossKind = 'scorpion';
      else if (biome.id === 'swamp') bossKind = 'crocodile';
      else if (biome.id === 'river') bossKind = 'eagle'; // jättikotka
      else if (biome.id === 'forest') bossKind = 'bear'; // jättikarhu
      else if (biome.id === 'volcano') bossKind = 'wolf';
      else if (biome.id === 'jungle') bossKind = 'panther'; // jättipantteri
      else if (biome.id === 'foggy_peaks') bossKind = 'eagle'; // jättikotka

      const list = [new Predator(center.x, 120, bossKind, speedMul, true)];
      if (lv >= 10) list.push(new Predator(corners[3].x, corners[3].y, 'fox', speedMul));
      if (lv >= 15) list.push(new Predator(corners[2].x, corners[2].y, 'wolf', speedMul));
      return list;
    }

    const count = Math.min(lv, 4);
    const list = [];
    
    // Suunnitellaan petopooli tason ja vuorokaudenajan mukaan
    const pool = ['bear', 'wolf'];
    if (lv >= 3) pool.push('fox');
    if (biome.id === 'jungle') {
      if (lv >= 4) pool.push('panther');
    } else {
      if (lv >= 4) pool.push('lynx');
    }
    if (isNightTime()) {
      pool.push('owl');
    } else {
      if (lv >= 6) pool.push('eagle');
    }

    for (let i = 0; i < count; i++) {
      let kind = pool[i % pool.length];
      let pX = corners[i].x;
      let pY = corners[i].y;
      
      // Jos peto on ilves tai pantteri, sijoitetaan se väijyyn pusikon sisälle jos mahdollista
      if ((kind === 'lynx' || kind === 'panther') && typeof obstacles !== 'undefined' && obstacles.length > 0) {
        const bushes = obstacles.filter(o => o.type === 'bush');
        if (bushes.length > 0) {
          const b = bushes[Math.floor(Math.random() * bushes.length)];
          pX = b.x;
          pY = b.y;
        }
      }
      list.push(new Predator(pX, pY, kind, speedMul));
    }
    return list;
  }

  // --- Saaliin luonti ---
  function spawnOnePrey() {
    let kind;
    if (isNightTime() && Math.random() < 0.65) {
      kind = 'bat';
    } else {
      const kinds = biome.prey;
      kind = kinds[Math.floor(Math.random() * kinds.length)];
    }
    // Ilmesty etäälle huskysta, ettei pääse heti kiinni
    for (let attempt = 0; attempt < 30; attempt++) {
      const p = randomPos(50);
      if (Math.hypot(p.x - husky.x, p.y - husky.y) > 150) {
        return new Prey(p.x, p.y, kind);
      }
    }
    const p = randomPos(50);
    return new Prey(p.x, p.y, kind);
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
      if (s.kind === 'cave') {
        // Luolassa on suoraan jalokiviä kerättäväksi!
        const gemCount = 2 + Math.floor(Math.random() * 3); // 2–4 gemiä
        for (let i = 0; i < gemCount; i++) {
          const g = GEMS[Math.floor(Math.random() * GEMS.length)];
          loot.push({
            x: 130 + Math.random() * (w.width - 260),
            y: 120 + Math.random() * (w.height - 270),
            radius: 14,
            gem: true,
            color: g.color,
            phase: Math.random() * Math.PI * 2
          });
        }
      } else {
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
      }
      s.loot = loot;
      // Ystävällinen eläin taloissa: auttaa kerran
      s.npc = s.hasNpc
        ? { x: w.width * 0.28, y: w.height * 0.42, radius: 15, kind: 'rabbit', flip: 1, animPhase: 0, moving: false, helped: false }
        : null;
      // Ansat koloissa ja luolissa: piikit jotka satuttavat
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
    if (s.kind === 'cave') {
      shopData.achievements.visitedCave = true;
      checkAchievements();
    }
    returnPos = { x: s.x, y: s.y + s.radius + husky.radius + 10 }; // ulko-oven eteen
    interior = buildInterior(s);
    fieldCollectibles = collectibles; // talleta kentän luut
    collectibles = interior.loot;     // sisätilan aarteet keräiltäviksi
    husky.x = interior.world.width / 2;
    husky.y = interior.world.height - 95; // oven sisäpuolelle
    husky.hidden = false;
    scene = 'interior';
    invulnTimer = 0.6;
    interiorExitCooldown = 0.65;
    showBanner(s.kind === 'house' ? '🏠 Sisällä!' : s.kind === 'den' ? '🕳️ Kolossa!' : '🪨 Luolassa!');
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
    
    // Kaupasta ostetut edut (tavarat)
    let bonusLives = 0;
    if (shopData.items && shopData.items.heartPotion > 0) {
      bonusLives = shopData.items.heartPotion;
      shopData.items.heartPotion = 0;
    }
    maxLives = 3 + bonusLives;
    lives = 3 + bonusLives;

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
    projectiles = [];
    volcanoTimer = 0;
    // Nollaa combot, kenttätapahtumat ja jalanjäljet
    comboCount = 0; comboMul = 1; comboTimer = 0;
    fieldEvent = null; fieldEventTimer = 0;
    footprints = []; footprintTimer = 0;
    fishingSpots = []; fishingProgress = 0;
    // Nollaa huskyn kokemustaso ja taidot
    perks = Skills.freshPerks();
    
    if (shopData.items && shopData.items.speedCharm > 0) {
      perks.speedMul *= 1.12;
      shopData.items.speedCharm = 0;
    }
    saveShopData();
    huskyLevel = 1;
    huskyXp = 0;
    xpToNext = xpForHuskyLevel(huskyLevel);
    scene = 'field';
    interior = null;
    currentSeason = getSeasonForLevel(level);
    bodyTemp = 50;
    freezeDmgTimer = 0;
    biome = biomeForLevel(level);
    timeOfDay = 0.3; // aamupäivä
    weather = pickWeather(biome.id);
    initWeatherParticles();
    structures = createStructures(level);
    obstacles = generateObstacles(level); // huom: viittaa structures-listaan
    husky = new Husky(center.x, center.y);
    husky.skin = shopData.equippedSkin;
    husky.hat = shopData.equippedHat;

    if (shopData.items && shopData.items.companion > 0) {
      const compSkin = shopData.equippedSkin === 'default' ? 'arctic' : 'default';
      companion = new Companion(center.x - 45, center.y, compSkin);
      companion.hat = shopData.equippedHat;
      companion.speed = 210 + ((shopData.cabinUpgrades.doghouse || 0) * 40);
    } else {
      companion = null;
    }

    lostPuppy = null;
    if (Math.random() < 0.35) {
      let pPos = randomPos(140);
      while (Math.hypot(pPos.x - center.x, pPos.y - center.y) < 250) {
        pPos = randomPos(140);
      }
      lostPuppy = {
        x: pPos.x, y: pPos.y, radius: 10,
        following: false, animPhase: 0, flip: 1
      };
    }

    tookDamageThisLevel = false;

    predators = predatorsForLevel(level);
    prey = [];
    refillPrey();
    collectibles = spawnCollectibles();
    renderPerks();
    updateXpBar();
    updateHud();
    renderAchievements(); // piirretään uudet saavutukset
  }

  // --- Tasonvaihto ---
  function nextLevel() {
    if (!tookDamageThisLevel) {
      shopData.achievements.noDamageLevel = true;
      checkAchievements();
    }
    tookDamageThisLevel = false;

    // Mökin ruokakuppi-moniste (aloitus-XP)
    if (shopData.cabinUpgrades.bowlLvl > 0) {
      huskyXp += shopData.cabinUpgrades.bowlLvl * 20;
      updateXpBar();
    }

    level++;
    caughtThisLevel = 0;
    goal = goalForLevel(level);
    scene = 'field';
    interior = null;

    lostPuppy = null;
    if (Math.random() < 0.35) {
      let pPos = randomPos(140);
      while (Math.hypot(pPos.x - center.x, pPos.y - center.y) < 250) {
        pPos = randomPos(140);
      }
      lostPuppy = {
        x: pPos.x, y: pPos.y, radius: 10,
        following: false, animPhase: 0, flip: 1
      };
    }
    currentSeason = getSeasonForLevel(level);
    bodyTemp = 50;
    freezeDmgTimer = 0;
    biome = biomeForLevel(level);
    weather = pickWeather(biome.id); // sää vaihtuu, vuorokausi jatkuu
    initWeatherParticles();
    digSpots = []; // uusi kenttä → vanhat kaivuupaikat katoavat
    // Nollaa tapahtumat ja jalanjäljet
    fieldEvent = null; fieldEventTimer = 15 + Math.random() * 20;
    footprints = []; footprintTimer = 0;
    fishingSpots = []; fishingProgress = 0;
    structures = createStructures(level);
    obstacles = generateObstacles(level);
    predators = predatorsForLevel(level);
    husky.x = center.x;
    husky.y = center.y;
    if (companion) {
      companion.x = center.x - 45;
      companion.y = center.y;
      companion.vx = 0;
      companion.vy = 0;
      companion.speed = 210 + ((shopData.cabinUpgrades.doghouse || 0) * 40);
    }
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
    updateTempHud();
  }

  function updateTempHud() {
    if (currentSeason === 'winter') {
      tempHud.style.display = 'block';
      tempValue.textContent = `${Math.round(bodyTemp)}°C`;
      if (bodyTemp < 25) {
        tempValue.style.color = '#7ad0ff';
        tempHud.style.borderColor = '#7ad0ff';
      } else {
        tempValue.style.color = '#ffffff';
        tempHud.style.borderColor = 'rgba(255,255,255,0.15)';
      }
    } else if (currentSeason === 'summer') {
      tempHud.style.display = 'block';
      tempValue.textContent = `${Math.round(bodyTemp)}°C`;
      if (bodyTemp >= 100) {
        tempValue.style.color = '#ff3333';
        tempHud.style.borderColor = '#ff3333';
      } else if (bodyTemp > 80) {
        tempValue.style.color = '#ff9900';
        tempHud.style.borderColor = '#ff9900';
      } else {
        tempValue.style.color = '#ffffff';
        tempHud.style.borderColor = 'rgba(255,255,255,0.15)';
      }
    } else {
      tempHud.style.display = 'none';
    }
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
    if (a.kind === 'eagle' && a.heightOffset > 15) return false;
    if (b.kind === 'eagle' && b.heightOffset > 15) return false;
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
  function hurtHusky(sx, sy, sourceName = 'peto') {
    const w = activeWorld();
    const dx = husky.x - sx, dy = husky.y - sy, d = Math.hypot(dx, dy) || 1;
    if (perks.hasShield && husky.shieldReady) {
      // Kilpi torjuu: ei menetetä elämää, kilpi latautuu uudelleen
      husky.shieldReady = false;
      husky.shieldCd = SHIELD_RECHARGE;
      invulnTimer = 1.2;
      shakeTimer = 0.2;
      spawnBurst(husky.x, husky.y, ['#7ad0ff', '#bfe0ff', '#fff'], 22);
      
      let bannerText = '🛡️ Kilpi suojasi!';
      if (sourceName === 'cactus') bannerText = '🛡️ Kilpi suojasi kaktukselta!';
      else if (sourceName === 'lava') bannerText = '🛡️ Kilpi suojasi laavalta!';
      else if (sourceName === 'fireball') bannerText = '🛡️ Kilpi suojasi magmakiveltä!';
      showBanner(bannerText);
      
      Audio.play('shield');
      husky.x = clamp(husky.x + (dx / d) * 80, husky.radius, w.width - husky.radius);
      husky.y = clamp(husky.y + (dy / d) * 80, husky.radius, w.height - husky.radius);
      return false;
    }
    
    // Savupommi torjuu osuman ja pelästyttää pedot
    if (shopData.items && shopData.items.smokeBomb > 0) {
      shopData.items.smokeBomb = 0;
      saveShopData();
      invulnTimer = 2.0;
      shakeTimer = 0.25;
      spawnBurst(husky.x, husky.y, ['#ffffff', '#dddddd', '#bbbbbb', '#999999'], 40);
      
      let bannerText = '💨 Savupommi pelasti sinut!';
      if (sourceName === 'cactus') bannerText = '💨 Savupommi suojasi kaktukselta!';
      else if (sourceName === 'lava') bannerText = '💨 Savupommi suojasi laavalta!';
      else if (sourceName === 'fireball') bannerText = '💨 Savupommi suojasi magmakiveltä!';
      showBanner(bannerText);
      
      Audio.play('howl');
      
      // Pelästytetään kaikki lähellä olevat pedot
      if (typeof predators !== 'undefined') {
        for (const pred of predators) {
          if (Math.hypot(pred.x - husky.x, pred.y - husky.y) < 320) {
            pred.scare(3.5);
          }
        }
      }
      
      husky.x = clamp(husky.x + (dx / d) * 80, husky.radius, w.width - husky.radius);
      husky.y = clamp(husky.y + (dy / d) * 80, husky.radius, w.height - husky.radius);
      return false;
    }
    
    lives--;
    tookDamageThisLevel = true;
    comboCount = 0; comboMul = 1; // osuma katkaisee kombon
    invulnTimer = 1.6;
    shakeTimer = 0.4;
    flashTimer = 0.4;
    if (sourceName === 'cactus') {
      showBanner('🌵 Osuit kaktukseen!');
    } else if (sourceName === 'lava') {
      showBanner('🔥 Laava polttaa!');
    } else if (sourceName === 'fireball') {
      showBanner('☄️ Magmakivi osui sinuun!');
    }
    spawnBurst(husky.x, husky.y, ['#ff5a4a', '#ffac4a'], 14);
    Audio.play('hurt');
    husky.x = clamp(husky.x + (dx / d) * 105, husky.radius, w.width - husky.radius);
    husky.y = clamp(husky.y + (dy / d) * 105, husky.radius, w.height - husky.radius);
    updateHud();
    return lives <= 0;
  }

  // Yhteinen apu: päivitä hiukkaset ja ruutuefektien ajastimet
  function updateEffects(dt) {
    if (husky) {
      husky.trailTimer = (husky.trailTimer || 0) + dt;
      if (husky.moving && husky.trailTimer > 0.08) {
        husky.trailTimer = 0;
        let colors = [];
        if (husky.skin === 'fire') colors = ['#ff4a00', '#ff9a00', '#ffe000'];
        else if (husky.skin === 'shadow') colors = ['#221133', '#110522', '#6b1133', '#ff0033'];
        else if (husky.skin === 'arctic') colors = ['#ffffff', '#cceeff', '#8ad0ff'];
        
        if (colors.length > 0) {
          particles.push({
            x: husky.x - husky.flip * husky.radius * 0.4,
            y: husky.y + husky.radius * 0.4 + (Math.random() - 0.5) * 6,
            vx: -husky.flip * (30 + Math.random() * 30),
            vy: -10 - Math.random() * 15,
            color: colors[Math.floor(Math.random() * colors.length)],
            size: 2.2 + Math.random() * 2.5,
            life: 0.45,
            maxLife: 0.45
          });
        }
      }
    }

    if (companion) {
      companion.trailTimer = (companion.trailTimer || 0) + dt;
      const compSkin = companion.skin || 'default';
      const compMoving = Math.hypot(companion.vx || 0, companion.vy || 0) > 10;
      if (compMoving && companion.trailTimer > 0.08) {
        companion.trailTimer = 0;
        let colors = [];
        if (compSkin === 'fire') colors = ['#ff4a00', '#ff9a00', '#ffe000'];
        else if (compSkin === 'shadow') colors = ['#221133', '#110522', '#6b1133', '#ff0033'];
        else if (compSkin === 'arctic') colors = ['#ffffff', '#cceeff', '#8ad0ff'];
        
        if (colors.length > 0) {
          particles.push({
            x: companion.x - companion.flip * companion.radius * 0.4,
            y: companion.y + companion.radius * 0.4 + (Math.random() - 0.5) * 6,
            vx: -companion.flip * (30 + Math.random() * 30),
            vy: -10 - Math.random() * 15,
            color: colors[Math.floor(Math.random() * colors.length)],
            size: 1.8 + Math.random() * 2.2,
            life: 0.45,
            maxLife: 0.45
          });
        }
      }
    }

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

  // Päivitä säähiukkaset (sade/lumi/tuhka/lumimyrsky/hiekkamyrsky) ruutukoordinaatistossa
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
      } else if (weather === 'blizzard') {
        p.drift += dt * 2;
        p.y += p.sp * 0.45 * dt;
        p.x += (p.windX || 280) * dt + Math.sin(p.drift) * 35 * dt;
        if (p.y > viewport.height) { p.y = -5; p.x = Math.random() * (-100); }
        if (p.x > viewport.width + 10) { p.x = -10; p.y = Math.random() * viewport.height; }
      } else if (weather === 'ash') {
        p.drift += dt;
        p.y += p.sp * dt;
        p.x += Math.sin(p.drift) * 12 * dt;
        if (p.y > viewport.height) { p.y = -5; p.x = Math.random() * viewport.width; }
        if (p.x < 0) p.x += viewport.width; else if (p.x > viewport.width) p.x -= viewport.width;
      } else if (weather === 'sandstorm') {
        p.drift += dt * 1.5;
        p.x += p.sp * sandstormPush.x * dt + Math.sin(p.drift) * 30 * dt;
        p.y += p.sp * sandstormPush.y * 0.3 * dt + Math.cos(p.drift) * 25 * dt;
        if (p.x > viewport.width + 20) p.x = -20;
        if (p.x < -20) p.x = viewport.width + 20;
        if (p.y > viewport.height + 20) p.y = -20;
        if (p.y < -20) p.y = viewport.height + 20;
      }
    }
  }

  // Säävaarat: lumimyrskyn jääpuikot, hiekkamyrskyn tuulipusku
  function updateWeatherHazards(dt) {
    if (scene !== 'field') return;
    if (weatherHazardBannerCd > 0) weatherHazardBannerCd -= dt;

    // --- Lumimyrsky: jääpuikot tippuvat rakenteista ---
    if (weather === 'blizzard') {
      icicleTimer += dt;
      const spawnInterval = Math.max(1.8, 3.2 - level * 0.08);
      if (icicleTimer > spawnInterval) {
        icicleTimer = 0;
        // Tiputa jääpuikko lähelle huskya (maailmakoordinaateissa)
        const angle = Math.random() * Math.PI * 2;
        const dist = 80 + Math.random() * 230;
        const tx = clamp(husky.x + Math.cos(angle) * dist, 60, world.width - 60);
        const ty = clamp(husky.y + Math.sin(angle) * dist, 60, world.height - 60);
        icicles.push({ x: tx, y: ty, radius: 38, timer: 1.4, maxTime: 1.4, hit: false });
      }
      for (const ic of icicles) {
        ic.timer -= dt;
        if (ic.timer <= 0 && !ic.hit) {
          ic.hit = true;
          spawnBurst(ic.x, ic.y, ['#b0d8ff', '#ffffff', '#c8f0ff'], 18);
          Audio.play('hurt');
          shakeTimer = Math.max(shakeTimer, 0.18);
          if (invulnTimer <= 0 && Math.hypot(husky.x - ic.x, husky.y - ic.y) < ic.radius) {
            if (weatherHazardBannerCd <= 0) {
              weatherHazardBannerCd = 3;
              showBanner('🧊 Jääpuikko osui! Väistä lumimyrskyssä!');
            }
            if (hurtHusky(ic.x, ic.y, 'icicle')) { gameOver(); return; }
          }
        }
      }
      icicles = icicles.filter(ic => ic.timer > -0.4);
    }

    // --- Hiekkamyrsky: tuulipuska ajaa huskya ---
    if (weather === 'sandstorm') {
      // Tuulen suunta vaihtelee hitaasti
      sandstormTimer += dt;
      if (sandstormTimer > 6.5) {
        sandstormTimer = 0;
        const ang = Math.random() * Math.PI * 2;
        sandstormPush.x = Math.cos(ang);
        sandstormPush.y = Math.sin(ang);
        if (weatherHazardBannerCd <= 0) {
          weatherHazardBannerCd = 5;
          showBanner('🏜️ Hiekkamyrsky repii! Taistele tuulta vastaan!');
        }
      }
      // Työnnetään huskya tuulen suuntaan (heikkenee kirmauksen aikana)
      const pushForce = husky.sprinting ? 22 : 55; // px/s tuulen vaikutus
      husky.x = clamp(husky.x + sandstormPush.x * pushForce * dt, husky.radius, world.width - husky.radius);
      husky.y = clamp(husky.y + sandstormPush.y * pushForce * dt, husky.radius, world.height - husky.radius);
    }
  }

  // --- Apufunktiot bestiarialle ---
  function preyEmoji(kind) {
    return { rabbit:'🐰', mouse:'🐭', squirrel:'🐿️', hedgehog:'🦔', bird:'🐦', deer:'🦌', beaver:'🦫', bat:'🦇', monkey:'🐒', mountain_goat:'🐐' }[kind] || '🐾';
  }
  function preyFinnish(kind) {
    return { rabbit:'Jänis', mouse:'Hiiri', squirrel:'Orava', hedgehog:'Siili', bird:'Lintu', deer:'Hirvi', beaver:'Majava', bat:'Lepakko', monkey:'Apina', mountain_goat:'Vuorivuohi' }[kind] || kind;
  }

  // --- Kenttätapahtumat ---
  function spawnFieldEvent() {
    fieldEventTimer = 30 + Math.random() * 40; // seuraava tapahtuma 30-70 s päästä
    if (isBossLevel(level)) return; // ei tapahtumia pomokentissä
    const types = ['aurora', 'meteor', 'swarm', 'merchant'];
    // Valitse tapahtuma biominmukaan
    const available = biome.id === 'snow' ? ['aurora', 'swarm', 'meteor'] :
                      biome.id === 'river' ? ['swarm', 'meteor', 'merchant'] :
                      biome.id === 'volcano' ? ['meteor', 'swarm'] :
                      types;
    const type = available[Math.floor(Math.random() * available.length)];
    const pos = randomPos(120);
    fieldEvent = { type, x: pos.x, y: pos.y, timer: 0, maxTimer: 12 };
    if (type === 'aurora') {
      showBanner('🌌 Revontulet — saaliit ihmeissään!');
      fieldEvent.maxTimer = 10;
    } else if (type === 'meteor') {
      showBanner('☄️ Meteori toi jalokiviä! Bongaa törmäyspaikka!');
      fieldEvent.maxTimer = 18;
      fieldEvent.collected = false;
    } else if (type === 'swarm') {
      showBanner('🐰🐰 Saalislaumat kokoontuvat — kiirehdittävä!');
      fieldEvent.maxTimer = 14;
      // Lisää ylimääräisiä saaliita lähelle paikkaa
      for (let i = 0; i < 5; i++) {
        const kinds = biome.prey;
        const a = Math.random() * Math.PI * 2, d = 60 + Math.random() * 100;
        prey.push(new Prey(
          clamp(pos.x + Math.cos(a)*d, 50, world.width-50),
          clamp(pos.y + Math.sin(a)*d, 50, world.height-50),
          kinds[Math.floor(Math.random() * kinds.length)]
        ));
      }
    } else if (type === 'merchant') {
      showBanner('🛒 Vaelteleva kauppias! Mene hänen luokseen!');
      fieldEvent.maxTimer = 20;
      fieldEvent.helped = false;
    }
    Audio.play('skill');
  }

  function updateFieldEvent(dt) {
    if (!fieldEvent) return;
    fieldEvent.timer += dt;
    const fe = fieldEvent;
    if (fe.type === 'merchant' && !fe.helped) {
      if (Math.hypot(husky.x - fe.x, husky.y - fe.y) < 70) {
        fe.helped = true;
        // Kauppias antaa joko elämän, jalokiven tai XP:tä
        const r = Math.random();
        if (r < 0.33 && lives < maxLives) { lives++; updateHud(); showBanner('🛒 Kauppias antoi +1 ❤️!'); }
        else if (r < 0.66) { gemsFound++; updateHud(); showBanner('🛒 Kauppias antoi 💎 jalokiven!'); }
        else { huskyXp += 8; updateXpBar(); showBanner('🛒 Kauppias antoi +8 XP!'); }
        spawnBurst(fe.x, fe.y, ['#ffd700','#ff9a00','#fff'], 22);
        Audio.play('goldbone');
        fieldEvent = null; return;
      }
    } else if (fe.type === 'meteor' && !fe.collected) {
      if (Math.hypot(husky.x - fe.x, husky.y - fe.y) < 55) {
        fe.collected = true;
        const gem = GEMS[Math.floor(Math.random() * GEMS.length)];
        gemsFound++;
        huskyXp += gem.xp;
        spawnBurst(fe.x, fe.y, [gem.color, '#fff', '#ffe070'], 28);
        Audio.play('gem');
        showBanner(`☄️ ${gem.name} löytyi meteoriksesta! +${gem.xp} XP`);
        updateHud(); updateXpBar();
        fieldEvent = null; return;
      }
    } else if (fe.type === 'aurora') {
      // Revontulet: kaikki saaliit seisahtuvat (simuloidaan: älä päivitä niiden tekoälyä)
      // Tilanne hoidetaan drawFieldissä visuaalisesti — aika loppuu automaattisesti
    }
    if (fieldEvent && fe.timer >= fe.maxTimer) {
      fieldEvent = null;
      fieldEventTimer = 20 + Math.random() * 30;
    }
  }

  // --- Kalastus (Jokivarsi-biomi) ---
  function updateFishing(dt) {
    // Alusta kalastuspaikat jos ei ole
    if (fishingSpots.length === 0) {
      for (let i = 0; i < 4; i++) {
        const p = randomPos(100);
        fishingSpots.push({ x: p.x, y: p.y, radius: 36, rechargeCd: 0 });
      }
    }
    for (const fs of fishingSpots) {
      if (fs.rechargeCd > 0) { fs.rechargeCd -= dt; continue; }
      if (!husky.moving && Math.hypot(husky.x - fs.x, husky.y - fs.y) < fs.radius) {
        fishingProgress += dt;
        if (fishingProgress >= 2.2) {
          fishingProgress = 0;
          fs.rechargeCd = 8;
          huskyXp += 4; updateXpBar();
          score += 2; updateHud();
          caughtThisLevel++;
          spawnBurst(fs.x, fs.y, ['#7ad0ff','#fff','#c8f8ff'], 18);
          showBanner('🎣 Sait lohen! +2 pistettä');
          Audio.play('catch');
        }
      } else {
        fishingProgress = Math.max(0, fishingProgress - dt * 1.5);
      }
    }
  }

  // --- Jokivarsi-biomi: jokiesteet (vesiväylät) generateObstacles kutsuttuna ---
  function generateRiverObjects() {
    const rivers = [];
    // 2-3 jokiväylää
    const count = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < count; i++) {
      // Pysty- tai vaakasuuntainen joki
      const vertical = Math.random() < 0.5;
      const cx = 200 + Math.random() * (world.width - 400);
      const cy = 200 + Math.random() * (world.height - 400);
      const len = 300 + Math.random() * 400;
      rivers.push({ x: cx, y: cy, len, vertical, width: 60 + Math.random() * 40 });
    }
    return rivers;
  }

  // Yhteinen apu: kerää luut (ja aarrekartta) huskyn ympäriltä
  function collectBones(dt) {
    for (const c of collectibles) {
      if (c.collected) continue;
      if (Math.hypot(husky.x - c.x, husky.y - c.y) < husky.radius + c.radius) {
        c.collected = true;
        if (c.gem) {
          gemsFound++;
          spawnBurst(c.x, c.y, [c.color, '#fff', '#ffe070'], 22);
          Audio.play('gem');
          showBanner('💎 Löysit jalokiven!');
          updateHud();
        } else if (c.map) {
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
    if (interiorExitCooldown > 0) interiorExitCooldown -= dt;
    if (currentSeason === 'winter') {
      if (interior.kind === 'house') {
        const nearFireplace = Math.hypot(husky.x - 380, husky.y - 120) < 85;
        const rate = nearFireplace ? 25 : 12;
        bodyTemp = Math.min(100, bodyTemp + dt * rate);
      } else {
        bodyTemp = Math.min(50, bodyTemp + dt * 8);
      }
    } else if (currentSeason === 'summer') {
      bodyTemp = Math.max(50, bodyTemp - dt * 10);
    } else {
      if (bodyTemp < 50) bodyTemp = Math.min(50, bodyTemp + dt * 10);
      else if (bodyTemp > 50) bodyTemp = Math.max(50, bodyTemp - dt * 10);
    }

    perks.isOverheating = (currentSeason === 'summer' && bodyTemp >= 100);

    const dir = Input.getDirection();
    husky.update(dt, dir, interior.world, interior.walls, perks, Input.isSprinting(), currentSeason);
    
    if (companion) {
      companion.update(dt, husky, [], interior.world, interior.walls);
    }
    Input.consumeHowl(); // kuluta painallus ettei laukea heti ulkona
    updateEffects(dt);
    collectBones(dt);
    Audio.setTension(0);
    if (invulnTimer > 0) invulnTimer -= dt;

    // Mökin tulisija (fireplace)
    if (interior.kind === 'house' && shopData.cabinUpgrades.fireplace > 0) {
      if (Math.hypot(husky.x - 380, husky.y - 120) < 65) {
        if (fireplaceHealTimer <= 0) {
          if (lives < maxLives) {
            lives++;
            updateHud();
            spawnBurst(380, 120, ['#ff4a00', '#ffd700', '#ff9ab0'], 14);
            Audio.play('goldbone');
            showBanner('🔥 Tulisijan lämpö paransi sinua! +1 ❤️');
          }
          fireplaceHealTimer = shopData.cabinUpgrades.fireplace === 2 ? 1.2 : 2.4;
        } else {
          fireplaceHealTimer -= dt;
        }
      }
    }

    // Nikkarointipöytä (workbench)
    if (interior.kind === 'house' && Math.hypot(husky.x - 160, husky.y - 320) < 38) {
      if (cabinOverlay.classList.contains('hidden')) {
        openCabinUpgrades();
      }
    }

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
    if (interiorExitCooldown <= 0 && Math.hypot(husky.x - ex.x, husky.y - ex.y) < husky.radius + ex.r) {
      exitInterior();
    }
  }

  function updateField(dt) {
    if (currentSeason === 'winter') {
      let nearFire = false;
      for (const o of obstacles) {
        if (o.type === 'campfire' && Math.hypot(husky.x - o.x, husky.y - o.y) < 65) {
          nearFire = true;
        }
      }
      if (nearFire) {
        bodyTemp = Math.min(100, bodyTemp + dt * 18);
        if (Math.random() < 0.12) spawnBurst(husky.x, husky.y, ['#ffaa00', '#ffd700'], 1);
      } else {
        bodyTemp = Math.max(0, bodyTemp - dt * (weather === 'blizzard' ? 2.8 : 1.4));
      }
      if (bodyTemp <= 0) {
        freezeDmgTimer -= dt;
        if (freezeDmgTimer <= 0) {
          if (hurtHusky(husky.x, husky.y, 'freeze')) {
            gameOver();
            return;
          }
          freezeDmgTimer = 5.0;
          showBanner('❄️ Palellutit! Lämpötilasi on 0°! Etsi nuotio!');
          Audio.play('hurt');
        }
      } else {
        freezeDmgTimer = 0;
      }
    } else if (currentSeason === 'summer') {
      if (husky.inWater) {
        bodyTemp = Math.max(50, bodyTemp - dt * 14);
      } else {
        bodyTemp = Math.min(100, bodyTemp + dt * (weather === 'sandstorm' ? 2.4 : 1.2));
      }
    } else {
      if (bodyTemp < 50) bodyTemp = Math.min(50, bodyTemp + dt * 10);
      else if (bodyTemp > 50) bodyTemp = Math.max(50, bodyTemp - dt * 10);
    }

    perks.isOverheating = (currentSeason === 'summer' && bodyTemp >= 100);

    const dir = Input.getDirection();
    husky.update(dt, dir, world, obstacles, perks, Input.isSprinting(), currentSeason);

    if (companion) {
      companion.update(dt, husky, prey, world, obstacles);
      for (const p of prey) {
        if (!p.alive) continue;
        const reach = companion.radius + p.radius;
        if (Math.hypot(companion.x - p.x, companion.y - p.y) < reach) {
          p.alive = false;
          score++;
          caughtThisLevel++;
          huskyXp++;
          shopData.achievements.caughtCount = (shopData.achievements.caughtCount || 0) + 1;
          checkAchievements();
          spawnBurst(p.x, p.y, ['#fff', '#ffe690', '#c8b490'], 14);
          Audio.play('catch');
          showBanner('🐕 Kaverisi nappasi saaliin!');
          updateHud();
          updateXpBar();
        }
      }
    }

    // Päivitä eksynyt huskypentu
    if (lostPuppy) {
      if (!lostPuppy.following) {
        lostPuppy.shiverX = Math.sin(gameTime * 25) * 0.4;
        if (Math.hypot(husky.x - lostPuppy.x, husky.y - lostPuppy.y) < 60) {
          lostPuppy.following = true;
          Audio.play('levelup');
          showBanner('🐾 Löysit eksyneen pennun! Johdata se mökille tai luolalle!');
        }
      } else {
        lostPuppy.shiverX = 0;
        const dist = Math.hypot(lostPuppy.x - husky.x, lostPuppy.y - husky.y);
        if (dist > 45) {
          const angle = Math.atan2(husky.y - lostPuppy.y, husky.x - lostPuppy.x);
          lostPuppy.x += Math.cos(angle) * 190 * dt;
          lostPuppy.y += Math.sin(angle) * 190 * dt;
          lostPuppy.flip = Math.cos(angle) < 0 ? -1 : 1;
          lostPuppy.animPhase += dt * 12;
        }

        for (const s of structures) {
          if (Math.hypot(lostPuppy.x - s.x, lostPuppy.y - s.y) < s.radius + lostPuppy.radius + 12) {
            spawnBurst(s.x, s.y, ['#ffb3d9', '#ffd700', '#ffffff'], 32);
            Audio.play('legendary');
            shopData.achievements.rescuedCount = (shopData.achievements.rescuedCount || 0) + 1;
            shopData.totalGems += 8;
            saveShopData();
            showBanner('👑 Pelastit pennun! +8 💎');
            checkAchievements();
            lostPuppy = null;
            break;
          }
        }
      }
    }

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
      let radius = 170 + perks.howlPower * 55;
      let duration = 2.5 + perks.howlPower * 0.6;
      if (perks.hasSmokeBomb) {
        radius *= 1.45;
        duration *= 1.5;
        spawnBurst(husky.x, husky.y, ['#888888', '#aaaaaa', '#cccccc', '#ffffff'], 40);
        showBanner('💨 Usvapommi sokeutti pedot!');
      }
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
    updateWeatherHazards(dt);
    updateDigging(dt); // kaivaminen ❌:n päällä

    // --- Combo-ajastin ---
    if (comboCount > 0) {
      comboTimer -= dt;
      if (comboTimer <= 0) {
        comboCount = 0;
        comboMul = 1;
      }
    }

    // --- Jalanjäljet (saaliiden ja petojen) ---
    footprintTimer -= dt;
    if (footprintTimer <= 0) {
      footprintTimer = 0.35;
      for (const p of prey) {
        if (!p.alive) continue;
        if (Math.random() < 0.6) footprints.push({ x: p.x + (Math.random()-0.5)*8, y: p.y + (Math.random()-0.5)*8, age: 0, maxAge: 8.0, kind: p.kind });
      }
      for (const pred of predators) {
        if (Math.random() < 0.5) footprints.push({ x: pred.x + (Math.random()-0.5)*6, y: pred.y + (Math.random()-0.5)*6, age: 0, maxAge: 6.0, kind: pred.kind });
      }
    }
    for (const f of footprints) f.age += dt;
    footprints = footprints.filter(f => f.age < f.maxAge);

    // --- Kalastus (jokivarsi) ---
    if (biome.id === 'river') updateFishing(dt);

    // --- Kenttätapahtumat ---
    fieldEventTimer -= dt;
    if (fieldEventTimer <= 0 && !fieldEvent) spawnFieldEvent();
    if (fieldEvent) updateFieldEvent(dt);

    for (const p of prey) {
      if (!p.alive) continue;
      p.update(dt, husky, world, obstacles, perks);
      // Nappausetäisyyttä kasvattaa Saalistaja-taito (perks.catchBonus)
      const reach = husky.radius + p.radius + perks.catchBonus;
      if (Math.hypot(husky.x - p.x, husky.y - p.y) < reach) {
        if (p.kind === 'monkey' && p.stolenBones === 0) {
          const stolen = Math.max(1, Math.min(score, 3));
          score = Math.max(0, score - stolen);
          p.stolenBones = stolen;
          
          const a = Math.random() * Math.PI * 2;
          p.x = clamp(p.x + Math.cos(a) * 160, 40, world.width - 40);
          p.y = clamp(p.y + Math.sin(a) * 160, 40, world.height - 40);
          p.speed *= 1.35;
          
          spawnBurst(p.x, p.y, ['#ff4a4a', '#8b5a2b'], 15);
          Audio.play('hurt');
          showBanner('🐒 Apina varasti luusi! Ota se kiinni!');
          updateHud();
          continue;
        }

        p.alive = false;
        shopData.achievements.caughtCount = (shopData.achievements.caughtCount || 0) + 1;
        // Merkitse eläin löydetyksi bestiariaan
        if (!shopData.discovered) shopData.discovered = {};
        if (!shopData.discovered[p.kind]) {
          shopData.discovered[p.kind] = true;
          showBanner(`📖 Bestiarium: ${preyEmoji(p.kind)} ${preyFinnish(p.kind)} löydetty!`);
          saveShopData();
        }
        checkAchievements();
        // Combo
        comboCount++;
        comboTimer = COMBO_TIMEOUT;
        comboMul = Math.min(4, 1 + Math.floor(comboCount / 3));

        let monkeyBonus = 0;
        if (p.kind === 'monkey' && p.stolenBones > 0) {
          monkeyBonus = p.stolenBones;
          showBanner('🐒 Sait apinan kiinni ja sait aarteesi takaisin!');
        }

        // Pisteet (hirvi=3p, majava=2p, muut=1p) × combo + apinan palauttama bonus
        const pts = (p.kind === 'deer' ? 3 : p.kind === 'beaver' ? 2 : 1) * comboMul + monkeyBonus;
        score += pts;
        caughtThisLevel++;
        let xpGained = pts;
        if (shopData.cabinUpgrades && shopData.cabinUpgrades.trophyWall) {
          xpGained = Math.round(xpGained * 1.15);
        }
        huskyXp += xpGained;
        if (comboMul >= 2) {
          spawnBurst(p.x, p.y, ['#ffd700','#ffb800','#fff'], 20);
        } else {
          spawnBurst(p.x, p.y, ['#fff', '#ffe8c0', '#d8c4a0'], 12);
        }
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
      pred.update(dt, husky, world, obstacles, perks, envMul, projectiles, isNightTime());

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
        if (pred.isBoss && pred.chargeState === 'recover') {
          const dmg = perks.ironBite ? 2 : 1;
          pred.hp = Math.max(0, pred.hp - dmg);
          spawnBurst(pred.x, pred.y, ['#ff4a4a', '#ffffff', '#ffd700'], 22);
          Audio.play('catch');
          if (pred.hp <= 0) {
            spawnBurst(pred.x, pred.y, ['#ffd700', '#ffffff', '#ffaa00'], 48);
            Audio.play('legendary');
            shopData.totalGems += 15;
            saveShopData();
            showBanner('👑 KUKISTIT POMON! +15 💎');
            nextLevel();
            return;
          } else {
            showBanner(perks.ironBite 
              ? `🦷 Raudankova purenta! Puraisit pomoa kahdesti! HP: ${pred.hp}/${pred.maxHp}`
              : `🐺 Puraisit pomoa! HP: ${pred.hp}/${pred.maxHp}`);
            pred.chargeState = 'none';
            pred.chargeCd = 3.2;
            invulnTimer = 1.0;
          }
        } else {
          if (hurtHusky(pred.x, pred.y)) { gameOver(); return; }
        }
      }
    }

    // Kaktustörmäykset (Aavikolla)
    if (invulnTimer <= 0) {
      for (const o of obstacles) {
        if (o.type === 'cactus' && collides(husky, o)) {
          if (hurtHusky(o.x, o.y, 'cactus')) { gameOver(); return; }
        }
      }
    }

    // Laavavahinko (Tulivuorimaa)
    if (biome.id === 'volcano') {
      let inLava = false;
      for (const o of obstacles) {
        if (o.type === 'lava' && Math.hypot(husky.x - o.x, husky.y - o.y) < o.radius) {
          inLava = true;
        }
      }
      if (inLava) {
        husky.lavaHeat = (husky.lavaHeat || 0) + dt;
        if (husky.lavaHeat > 1.2 && invulnTimer <= 0) {
          husky.lavaHeat = 0;
          if (hurtHusky(husky.x, husky.y, 'lava')) { gameOver(); return; }
        }
      } else {
        husky.lavaHeat = Math.max(0, (husky.lavaHeat || 0) - dt * 2);
      }
    }

    // Tipahtavat magmakivet (Tulivuorimaa)
    if (biome.id === 'volcano') {
      volcanoTimer += dt;
      if (volcanoTimer > 3.8) {
        volcanoTimer = 0;
        const a = Math.random() * Math.PI * 2;
        const d = 60 + Math.random() * 180;
        const tx = clamp(husky.x + Math.cos(a) * d, 60, world.width - 60);
        const ty = clamp(husky.y + Math.sin(a) * d, 60, world.height - 60);
        projectiles.push({ x: tx, y: ty, radius: 48, timer: 1.6, maxTime: 1.6, type: 'volcano' });
      }
    }

    // Päivitä kaikki aktiiviset projektilit (laskeutuvat tulikivet & lentävät lumipallot/pistimet)
    for (const proj of projectiles) {
      if (proj.vx !== undefined) {
        // Lentävät projektilit (Yeti lumipallo, Skorpioni pistin)
        proj.x += proj.vx * dt;
        proj.y += proj.vy * dt;
        proj.timer -= dt;

        // Osuma Huskyyn
        if (invulnTimer <= 0 && Math.hypot(husky.x - proj.x, husky.y - proj.y) < husky.radius + proj.radius) {
          proj.timer = 0; // tuhotaan heti
          if (proj.type === 'snowball') {
            husky.slowTimer = 3.5;
            spawnBurst(proj.x, proj.y, ['#ffffff', '#cbe6ff'], 14);
            Audio.play('catch');
            showBanner('❄️ Palelutit! Hidastuit 3.5 sekunniksi!');
          } else if (proj.type === 'sting') {
            spawnBurst(proj.x, proj.y, ['#ff2a4b', '#9e1b2b'], 20);
            if (hurtHusky(proj.x, proj.y, 'scorpion_sting')) { gameOver(); return; }
          }
        }
        // Osuma esteeseen (vain kiinteät)
        for (const o of obstacles) {
          if (o.solid && Math.hypot(proj.x - o.x, proj.y - o.y) < o.radius + proj.radius) {
            proj.timer = 0;
            spawnBurst(proj.x, proj.y, proj.type === 'snowball' ? ['#ffffff', '#cbe6ff'] : ['#ff2a4b', '#9e1b2b'], 10);
          }
        }
      } else {
        // Laskeutuvat magmakivet
        proj.timer -= dt;
        if (proj.timer <= 0) {
          spawnBurst(proj.x, proj.y, ['#ff4a00', '#ff9a00', '#ffe000', '#555555'], 28);
          shakeTimer = Math.max(shakeTimer, 0.35);
          Audio.play('hurt');
          if (invulnTimer <= 0 && Math.hypot(husky.x - proj.x, husky.y - proj.y) < proj.radius) {
            if (hurtHusky(proj.x, proj.y, 'fireball')) { gameOver(); return; }
          }
        }
      }
    }
    projectiles = projectiles.filter(p => p.timer > 0);

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
      } else if (c.gem) {
        // Jalokivi
        ctx.save();
        ctx.translate(c.x, c.y + bob);
        ctx.fillStyle = c.color || '#ff4a6a';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, -c.radius);
        ctx.lineTo(c.radius, 0);
        ctx.lineTo(0, c.radius);
        ctx.lineTo(-c.radius, 0);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
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
    // Combo-ilmaisin huskyn yläpuolella
    if (comboCount > 0) {
      ctx.save();
      const pulse = 0.8 + 0.2 * Math.abs(Math.sin(gameTime * 14));
      ctx.fillStyle = comboMul >= 3 ? '#ffdf4a' : comboMul >= 2 ? '#ffb800' : '#ffffff';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeText(`COMBO x${comboMul} (${comboCount})`, husky.x, husky.y - husky.radius - 20);
      ctx.fillText(`COMBO x${comboMul} (${comboCount})`, husky.x, husky.y - husky.radius - 20);
      
      // Pieni edistymispalkki combon kestoajalle
      const barW = 34;
      const barH = 3.5;
      const bx = husky.x - barW / 2;
      const by = husky.y - husky.radius - 12;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(bx, by, barW, barH);
      ctx.fillStyle = '#ff8f30';
      ctx.fillRect(bx, by, barW * (comboTimer / COMBO_TIMEOUT), barH);
      ctx.restore();
    }
  }

  // Talo (🏠), kolo (🕳️) tai luola (🪨) sisäänkäynteineen + "mene sisään" -vihje
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
    } else if (s.kind === 'den') {
      ctx.fillStyle = '#3a2e22';
      ctx.beginPath(); ctx.ellipse(0, r * 0.3, r * 1.15, r * 0.75, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#120d08';
      ctx.beginPath(); ctx.ellipse(0, r * 0.38, r * 0.72, r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    } else if (s.kind === 'cave') {
      // Luolan piirto: kasa kivenlohkareita, ja pimeä reikä keskellä
      ctx.fillStyle = '#55555c';
      ctx.beginPath(); ctx.arc(-r * 0.45, r * 0.2, r * 0.65, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(r * 0.45, r * 0.2, r * 0.65, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(0, -r * 0.15, r * 0.72, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#101015';
      ctx.beginPath(); ctx.ellipse(0, r * 0.3, r * 0.62, r * 0.42, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    // Tunnus + vihje
    const near = Math.hypot(husky.x - s.x, husky.y - s.y) < s.radius + 80;
    ctx.font = 'bold 26px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(s.kind === 'house' ? '🏠' : s.kind === 'den' ? '🕳️' : '🪨', s.x, s.y - s.radius - 18);
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

    // --- Jokivarsi: piirretään jokiväylät ---
    if (biome.id === 'river') {
      for (const rv of fishingSpots) {
        // Kalastuspaikat sinertävinä pyöreä altaina
        const r2 = rv.rechargeCd > 0 ? 0.3 : 0.7;
        ctx.save();
        ctx.globalAlpha = r2;
        const wg = ctx.createRadialGradient(rv.x, rv.y, rv.radius * 0.2, rv.x, rv.y, rv.radius);
        wg.addColorStop(0, '#4ac0f8');
        wg.addColorStop(1, 'rgba(30,120,200,0)');
        ctx.fillStyle = wg;
        ctx.beginPath();
        ctx.arc(rv.x, rv.y, rv.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        if (rv.rechargeCd <= 0) {
          ctx.fillStyle = '#fff';
          ctx.font = '16px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('🎣', rv.x, rv.y + 6);
          // Kalastusedistymä
          if (fishingProgress > 0 && Math.hypot(husky.x - rv.x, husky.y - rv.y) < rv.radius) {
            ctx.fillStyle = 'rgba(0,0,0,0.35)';
            ctx.fillRect(rv.x - 22, rv.y + rv.radius + 4, 44, 7);
            ctx.fillStyle = '#7ad0ff';
            ctx.fillRect(rv.x - 22, rv.y + rv.radius + 4, 44 * (fishingProgress / 2.2), 7);
          }
        }
        ctx.restore();
      }
    }

    // --- Jalanjäljet maahan (saaliit ja pedot) ---
    for (const f of footprints) {
      const alpha = Math.max(0, (1 - f.age / f.maxAge) * 0.45);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = f.kind === 'wolf' || f.kind === 'bear' || f.kind === 'lynx' || f.kind === 'fox' ? '#ff6040' : '#a08060';
      ctx.beginPath();
      ctx.arc(f.x, f.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // --- Kenttätapahtumien visuaalit ---
    if (fieldEvent) {
      const fe = fieldEvent;
      const pulse = 0.5 + 0.5 * Math.abs(Math.sin(gameTime * 3));
      if (fe.type === 'aurora') {
        // Revontulet: vihreä/violetti shimmer koko ruudun yli (piirretään ruutukoord:ssa myöhemmin)
        // Paikalliset aaltokiilat maailmakoordinaateissa
        for (let i = 0; i < 3; i++) {
          ctx.save();
          ctx.globalAlpha = 0.12 + pulse * 0.1;
          ctx.fillStyle = ['#00ff88', '#aa44ff', '#44aaff'][i];
          ctx.beginPath();
          ctx.ellipse(fe.x + i*220 - 220, fe.y, 120 + i*60, 40, Math.sin(gameTime * 0.8 + i) * 0.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      } else if (fe.type === 'meteor' && !fe.collected) {
        // Kraatteri: oranssi/keltainen rengas + hyppivä meteori-emoji
        ctx.save();
        ctx.globalAlpha = 0.35 + pulse * 0.3;
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 5]);
        ctx.beginPath();
        ctx.arc(fe.x, fe.y, 55, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        ctx.font = `${28 + Math.round(pulse * 6)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('☄️', fe.x, fe.y - 12 - pulse * 8);
        ctx.restore();
      } else if (fe.type === 'merchant' && !fe.helped) {
        // Kauppias: iloisesti kimaltava kärryn ikoni
        ctx.save();
        ctx.globalAlpha = 0.5 + pulse * 0.4;
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.arc(fe.x, fe.y, 50, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        ctx.font = '26px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🛒', fe.x, fe.y + 8);
        ctx.font = 'bold 11px sans-serif';
        ctx.fillStyle = '#ffd700';
        ctx.fillText('Kauppias!', fe.x, fe.y - 28);
        ctx.restore();
      } else if (fe.type === 'swarm') {
        // Lauma: pulssirengas
        ctx.save();
        ctx.globalAlpha = 0.25 + pulse * 0.25;
        ctx.strokeStyle = '#ffe070';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 5]);
        ctx.beginPath();
        ctx.arc(fe.x, fe.y, 80 + pulse * 20, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
    }

    for (const pred of predators) pred.drawVision(ctx);
    drawDigSpots(); // maahan, hahmojen alle
    for (const s of structures) drawStructure(s);
    for (const o of obstacles) if (o.type === 'rock') o.draw(ctx, biome);
    drawCollectibles();
    for (const p of prey) p.draw(ctx);


    // Piirretään projektilit
    for (const proj of projectiles) {
      if (proj.type === 'volcano') {
        const ratio = proj.timer / proj.maxTime;
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 40, 0, 0.75)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, proj.radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = `rgba(255, 50, 0, ${(1 - ratio) * 0.28})`;
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, proj.radius * (1 - ratio), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        // Lentävät projektilit (snowball tai sting)
        ctx.save();
        if (proj.type === 'snowball') {
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#85c3e8';
          ctx.lineWidth = 2.0;
          ctx.beginPath();
          ctx.arc(proj.x, proj.y, proj.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        } else if (proj.type === 'sting') {
          ctx.fillStyle = '#ff2a4b';
          ctx.strokeStyle = '#4a1010';
          ctx.lineWidth = 2.0;
          ctx.beginPath();
          ctx.arc(proj.x, proj.y, proj.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
        ctx.restore();
      }
    }

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
          ? 'rgba(120,180,255,0.7)' : 'rgba(255,70,60,0.5)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(pred.x, pred.y, pred.radius + 6, 0, Math.PI * 2);
        ctx.stroke();

        ctx.font = `${pred.radius * 0.9}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('👑', pred.x, pred.y - pred.radius - 8);

        if (pred.chargeState === 'recover') {
          const starAnim = (gameTime * 6) % (Math.PI * 2);
          ctx.fillStyle = '#ffdf4a';
          ctx.font = '11px sans-serif';
          for (let i = 0; i < 3; i++) {
            const angle = starAnim + (i / 3) * Math.PI * 2;
            const sx = pred.x + Math.cos(angle) * (pred.radius * 0.8);
            const sy = pred.y - pred.radius - 22 + Math.sin(angle) * 3;
            ctx.fillText('⭐', sx, sy);
          }
        }

        if (pred.hp !== undefined) {
          const bw = pred.radius * 1.5, bh = 4.5;
          const bx = pred.x - bw / 2, by = pred.y - pred.radius - 24;
          ctx.fillStyle = 'rgba(0,0,0,0.5)';
          ctx.fillRect(bx, by, bw, bh);
          ctx.fillStyle = pred.chargeState === 'recover' ? '#7ad0ff' : '#ff4545';
          ctx.fillRect(bx, by, bw * (pred.hp / pred.maxHp), bh);
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 0.8;
          ctx.strokeRect(bx, by, bw, bh);
        }
      }
    }

    if (lostPuppy) {
      ctx.save();
      // Värise hieman jos odottaa
      const sx = lostPuppy.following ? 0 : lostPuppy.shiverX;
      ctx.translate(lostPuppy.x + sx, lostPuppy.y);
      if (lostPuppy.flip < 0) ctx.scale(-1, 1);

      // Varjo
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.ellipse(0, lostPuppy.radius * 0.9, lostPuppy.radius * 1.1, lostPuppy.radius * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Keho
      ctx.fillStyle = '#8a8a92';
      ctx.beginPath();
      ctx.ellipse(0, 0, lostPuppy.radius * 1.1, lostPuppy.radius * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();

      // Naama
      ctx.fillStyle = '#6b6b72';
      const hx = lostPuppy.radius * 0.7, hy = -lostPuppy.radius * 0.3;
      ctx.beginPath();
      ctx.arc(hx, hy, lostPuppy.radius * 0.65, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e8e8e8';
      ctx.beginPath();
      ctx.arc(hx + lostPuppy.radius * 0.4, hy + lostPuppy.radius * 0.15, lostPuppy.radius * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4a4a50';
      ctx.beginPath();
      ctx.moveTo(hx - lostPuppy.radius * 0.35, hy - lostPuppy.radius * 0.4);
      ctx.lineTo(hx - lostPuppy.radius * 0.1, hy - lostPuppy.radius * 0.9);
      ctx.lineTo(hx + lostPuppy.radius * 0.1, hy - lostPuppy.radius * 0.4);
      ctx.fill();

      ctx.restore();

      if (!lostPuppy.following) {
        ctx.save();
        const bounce = Math.sin(gameTime * 6) * 3;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        const label = '🥺 Uik!';
        const textW = ctx.measureText(label).width;
        ctx.fillRect(lostPuppy.x - textW / 2 - 6, lostPuppy.y - lostPuppy.radius - 22 + bounce, textW + 12, 16);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(label, lostPuppy.x, lostPuppy.y - lostPuppy.radius - 10 + bounce);
        ctx.restore();
      } else {
        ctx.save();
        ctx.fillStyle = '#ff4a7a';
        ctx.font = '14px serif';
        ctx.textAlign = 'center';
        ctx.fillText('💖', lostPuppy.x, lostPuppy.y - lostPuppy.radius - 8 + Math.sin(gameTime * 8) * 2);
        ctx.restore();
      }
    }

    if (companion) companion.draw(ctx);
    drawHusky();

    if (biome.id === 'volcano') {
      for (const proj of projectiles) {
        if (proj.type !== 'volcano') continue;
        const ratio = proj.timer / proj.maxTime;
        if (ratio > 0.04) {
          ctx.save();
          const height = proj.radius * 4.5 * ratio;
          ctx.fillStyle = '#ff7c00';
          ctx.strokeStyle = '#ffe000';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(proj.x, proj.y - height, 9 + (1 - ratio) * 5, 0, Math.PI * 2);
          ctx.fill(); ctx.stroke();

          ctx.fillStyle = 'rgba(100,100,100,0.55)';
          ctx.beginPath();
          ctx.arc(proj.x + Math.sin(gameTime * 10) * 3, proj.y - height - 10, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    }

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
    ctx.fillStyle = interior.kind === 'house' ? '#5a4636' : interior.kind === 'den' ? '#332a20' : '#141416';
    ctx.fillRect(0, 0, iw.width, iw.height);
    drawGrid(iw);
    // Seinäkehys
    ctx.strokeStyle = '#241a12';
    ctx.lineWidth = 16;
    ctx.strokeRect(8, 8, iw.width - 16, iw.height - 16);
    for (const o of interior.walls) o.draw(ctx);

    // Piirretään mökin parantelut
    if (interior.kind === 'house') {
      const upg = shopData.cabinUpgrades;

      // 1. Tulisija (fireplace)
      ctx.save();
      ctx.fillStyle = '#4a453f';
      ctx.fillRect(350, 80, 60, 45);
      ctx.strokeStyle = '#2d2925';
      ctx.lineWidth = 3;
      ctx.strokeRect(350, 80, 60, 45);

      if (upg.fireplace > 0) {
        const pulse = 0.85 + 0.15 * Math.abs(Math.sin(gameTime * 10));
        const radGrd = ctx.createRadialGradient(380, 110, 5, 380, 110, upg.fireplace === 2 ? 40 : 25);
        radGrd.addColorStop(0, `rgba(255, 220, 50, ${pulse})`);
        radGrd.addColorStop(0.4, `rgba(255, 90, 0, ${0.8 * pulse})`);
        radGrd.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = radGrd;
        ctx.beginPath();
        ctx.arc(380, 110, upg.fireplace === 2 ? 40 : 25, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.font = '22px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🔥', 380, 102);
      }
      ctx.restore();

      // 2. Työpöytä (workbench)
      ctx.save();
      ctx.fillStyle = '#7c583c';
      ctx.fillRect(135, 295, 50, 42);
      ctx.strokeStyle = '#4e3320';
      ctx.lineWidth = 3;
      ctx.strokeRect(135, 295, 50, 42);
      ctx.font = '18px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🔨', 160, 316);
      
      const pulse = 0.5 + 0.5 * Math.abs(Math.sin(gameTime * 4));
      ctx.strokeStyle = `rgba(255, 215, 0, ${0.2 + pulse * 0.4})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(160, 316, 26 + pulse * 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // 3. Palkintohylly (trophyWall)
      if (upg.trophyWall) {
        ctx.save();
        ctx.fillStyle = '#6a4e38';
        ctx.fillRect(130, 138, 60, 12);
        ctx.font = '14px sans-serif';
        ctx.fillText('🏆', 145, 130);
        ctx.fillText('🔮', 175, 130);
        ctx.restore();
      }

      // 4. Koiran peti (doghouse)
      if (upg.doghouse > 0) {
        ctx.save();
        ctx.fillStyle = '#8a6245';
        ctx.beginPath();
        ctx.arc(580, 150, 24, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#b88c68';
        ctx.beginPath();
        ctx.arc(580, 150, 18, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.font = upg.doghouse === 2 ? '22px sans-serif' : '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(upg.doghouse === 2 ? '🏠' : '🛏️', 580, 150);
        ctx.restore();
      }

      // 5. Ruokakuppi (food bowl)
      if (upg.bowlLvl > 0) {
        ctx.save();
        ctx.fillStyle = '#4a7ab5';
        ctx.beginPath();
        ctx.arc(380, 220, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fdfdfd';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🥣', 380, 220);
        ctx.restore();
      }
    }

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
    
    if (companion) companion.draw(ctx);
    drawHusky();

    // Pimeys luolassa (Radial Gradient -maski Huskyn ympärillä)
    if (interior.kind === 'cave') {
      const hasLantern = shopData.items && shopData.items.lantern > 0;
      const lightRadius = hasLantern ? 230 : 120;
      ctx.save();
      const grd = ctx.createRadialGradient(husky.x, husky.y, 10, husky.x, husky.y, lightRadius);
      grd.addColorStop(0, 'rgba(0,0,0,0)');
      grd.addColorStop(0.35, 'rgba(0,0,0,0.1)');
      grd.addColorStop(0.85, 'rgba(5,5,8,0.96)');
      grd.addColorStop(1, '#050508');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, iw.width, iw.height);
      ctx.restore();
    }
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

  // Sää: sadeviivat / lumihiutaleet / sumuverho / tuhkasade / lumimyrsky / hiekkamyrsky (ruutukoordinaatisto)
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
    } else if (weather === 'blizzard') {
      // Lumimyrsky: tiheä lumi + sinertävä sumu
      ctx.fillStyle = 'rgba(190,215,255,0.18)';
      ctx.fillRect(0, 0, viewport.width, viewport.height);
      ctx.fillStyle = 'rgba(255,255,255,0.88)';
      for (const p of weatherParticles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      // Piirretään jääpuikkojen varoitusympyrät (maailmakoord → ruutukoord)
      for (const ic of icicles) {
        if (ic.hit) continue;
        const sx = ic.x - cam.x;
        const sy = ic.y - cam.y;
        const progress = 1 - ic.timer / ic.maxTime;
        const alpha = 0.15 + progress * 0.55;
        const r = ic.radius * (0.4 + progress * 0.6);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = '#88ccff';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = alpha * 0.4;
        ctx.fillStyle = '#c8f0ff';
        ctx.fill();
        // Jääpuikko-symboli
        ctx.globalAlpha = Math.min(1, alpha + 0.3);
        ctx.setLineDash([]);
        ctx.fillStyle = '#ddeeff';
        ctx.font = `bold ${14 + Math.round(progress * 10)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('🧊', sx, sy - r * 0.2);
        ctx.restore();
      }
    } else if (weather === 'fog') {
      ctx.fillStyle = biome.id === 'foggy_peaks' ? 'rgba(215,222,230,0.58)' : 'rgba(200,205,212,0.3)';
      ctx.fillRect(0, 0, viewport.width, viewport.height);
    } else if (weather === 'ash') {
      ctx.fillStyle = 'rgba(85,80,75,0.8)';
      for (const p of weatherParticles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (weather === 'sandstorm') {
      // Hiekkamyrsky: ruskea/keltainen peite + lentelevät hiekanjyvät
      // Taustapeite: tiheys kasvaa reunoilta
      const grd = ctx.createRadialGradient(
        viewport.width / 2, viewport.height / 2, viewport.height * 0.1,
        viewport.width / 2, viewport.height / 2, viewport.height * 0.75);
      grd.addColorStop(0, 'rgba(200,160,70,0.12)');
      grd.addColorStop(1, 'rgba(200,140,40,0.42)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, viewport.width, viewport.height);
      // Hiekanjyvät
      for (const p of weatherParticles) {
        ctx.globalAlpha = p.alpha || 0.5;
        ctx.fillStyle = `hsl(${36 + Math.round(p.r * 4)}, 72%, 52%)`;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.r * 2.5, p.r * 0.7, Math.atan2(sandstormPush.y, sandstormPush.x), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      // Tuulinuoli HUDissa (oikeassa yläkulmassa)
      const arrowX = 22, arrowY = viewport.height - 28;
      ctx.save();
      ctx.translate(arrowX, arrowY);
      ctx.rotate(Math.atan2(sandstormPush.y, sandstormPush.x));
      ctx.fillStyle = 'rgba(220,160,40,0.85)';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('💨 Tuuli', 18, 5);
      ctx.beginPath();
      ctx.moveTo(-12, 0); ctx.lineTo(12, 0);
      ctx.moveTo(5, -6); ctx.lineTo(12, 0); ctx.lineTo(5, 6);
      ctx.strokeStyle = 'rgba(255,200,80,0.9)';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();
    }

    // Revontulet ruutukoordinaateissa (jos revontulitapahtuma on käynnissä)
    if (fieldEvent && fieldEvent.type === 'aurora') {
      const pulse = 0.5 + 0.5 * Math.abs(Math.sin(gameTime * 2));
      const grd = ctx.createLinearGradient(0, 0, 0, viewport.height * 0.75);
      grd.addColorStop(0, `rgba(0, 255, 120, ${0.15 * pulse})`);
      grd.addColorStop(0.3, `rgba(170, 70, 255, ${0.12 * pulse})`);
      grd.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grd;
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
      ctx.fillStyle = s.kind === 'house' ? '#d8a060' : s.kind === 'den' ? '#7a5a3a' : '#888890';
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
    if (running) {
      updateTempHud();
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

    // Lisää kerätyt jalokivet pysyvään saldoon
    if (typeof shopData !== 'undefined') {
      shopData.totalGems += gemsFound;
      saveShopData();
    }

    overlayText.textContent =
      `Peli päättyi tasolla ${level}! Husky ehti tasolle ${huskyLevel} ja pyydysti yhteensä ${score} eläintä.`;
    renderHighScores(newRecord);
    renderAchievements();
    startBtn.textContent = 'Pelaa uudelleen';
    overlay.classList.remove('hidden');
  }

  // --- Jalokivikaupan määrittely ja logiikka ---
  const SKINS = [
    { id: 'default', name: 'Alkuperäinen', emoji: '🐺', cost: 0, desc: 'Klassinen harmaa husky.' },
    { id: 'fire', name: 'Tuli', emoji: '🔥', cost: 25, desc: 'Liekkeinä loimuava husky keltaisin silmin.' },
    { id: 'shadow', name: 'Yö', emoji: '🖤', cost: 15, desc: 'Synkkä varjohusky punaisin silmin.' },
    { id: 'arctic', name: 'Napapiiri', emoji: '❄️', cost: 20, desc: 'Lumivalkoinen husky jäänsinisin silmin.' }
  ];

  const ITEMS = [
    { id: 'heartPotion', name: 'Parannusjuoma', emoji: '❤️', cost: 6, max: 2, desc: 'Aloita seuraava peli yhdellä lisäelämällä.' },
    { id: 'speedCharm', name: 'Kipinätassu', emoji: '⚡', cost: 10, max: 1, desc: 'Aloita seuraava peli +12 % nopeudella.' },
    { id: 'smokeBomb', name: 'Savupommi', emoji: '💨', cost: 8, max: 1, desc: 'Torjuu osuman, sokaisee pedot savulla.' },
    { id: 'lantern', name: 'Lyhty', emoji: '🏮', cost: 12, max: 1, desc: 'Pysyvä lyhty, joka suurentaa näkökenttää luolissa.' },
    { id: 'companion', name: 'Laumakaveri', emoji: '🐕', cost: 30, max: 1, desc: 'Seuraa pelaajaa ja saalistaa kentällä!' }
  ];

  const HATS = [
    { id: 'christmas', name: 'Tonttulakki', emoji: '🎅', cost: 15, desc: 'Punainen pehmeä tonttulakki.' },
    { id: 'detective', name: 'Etsivän hattu', emoji: '🕵️', cost: 12, desc: 'Klassinen Sherlock-salapoliisihattu.' },
    { id: 'crown', name: 'Kuninkaan kruunu', emoji: '👑', cost: 25, desc: 'Kultainen kruunu todellisille kuninkaallisille.' },
    { id: 'glasses', name: 'Aurinkolasit', emoji: '🕶️', cost: 10, desc: 'Siistit tummat lasit heijastuksella.' }
  ];

  function renderShop() {
    if (typeof shopData === 'undefined') return;
    shopGemCount.textContent = shopData.totalGems;

    // Renderöidään skinit
    shopSkinsList.innerHTML = SKINS.map(s => {
      const isOwned = shopData.ownedSkins.includes(s.id);
      const isEquipped = shopData.equippedSkin === s.id;

      let btnHtml = '';
      if (isEquipped) {
        btnHtml = `<button class="shop-btn equipped" disabled>Käytössä</button>`;
      } else if (isOwned) {
        btnHtml = `<button class="shop-btn equip" data-skin="${s.id}">Valitse</button>`;
      } else {
        const canAfford = shopData.totalGems >= s.cost;
        btnHtml = `<button class="shop-btn buy ${canAfford ? '' : 'disabled'}" data-skin="${s.id}" ${canAfford ? '' : 'disabled'}>Osta</button>`;
      }

      return `
        <div class="shop-item">
          <div class="shop-item-info">
            <div class="shop-item-title">${s.emoji} ${s.name}</div>
            <div class="shop-item-desc">${s.desc}</div>
            ${isOwned ? '' : `<div class="shop-item-cost">💎 ${s.cost}</div>`}
          </div>
          ${btnHtml}
        </div>
      `;
    }).join('');

    // Renderöidään tavarat
    shopItemsList.innerHTML = ITEMS.map(item => {
      const currentStock = shopData.items[item.id] || 0;
      const isMax = currentStock >= item.max;

      let btnHtml = '';
      if (isMax) {
        btnHtml = `<button class="shop-btn disabled" disabled>Täynnä</button>`;
      } else {
        const canAfford = shopData.totalGems >= item.cost;
        btnHtml = `<button class="shop-btn buy ${canAfford ? '' : 'disabled'}" data-item="${item.id}" ${canAfford ? '' : 'disabled'}>Osta</button>`;
      }

      return `
        <div class="shop-item">
          <div class="shop-item-info">
            <div class="shop-item-title">${item.emoji} ${item.name} (${currentStock}/${item.max})</div>
            <div class="shop-item-desc">${item.desc}</div>
            <div class="shop-item-cost">💎 ${item.cost}</div>
          </div>
          ${btnHtml}
        </div>
      `;
    }).join('');

    // Renderöidään asusteet
    shopHatsList.innerHTML = HATS.map(h => {
      const isOwned = shopData.ownedHats.includes(h.id);
      const isEquipped = shopData.equippedHat === h.id;

      let btnHtml = '';
      if (isEquipped) {
        btnHtml = `<button class="shop-btn equipped" data-hat="${h.id}">Käytössä</button>`;
      } else if (isOwned) {
        btnHtml = `<button class="shop-btn equip" data-hat="${h.id}">Valitse</button>`;
      } else {
        const canAfford = shopData.totalGems >= h.cost;
        btnHtml = `<button class="shop-btn buy ${canAfford ? '' : 'disabled'}" data-hat="${h.id}" ${canAfford ? '' : 'disabled'}>Osta</button>`;
      }

      return `
        <div class="shop-item">
          <div class="shop-item-info">
            <div class="shop-item-title">${h.emoji} ${h.name}</div>
            <div class="shop-item-desc">${h.desc}</div>
            ${isOwned ? '' : `<div class="shop-item-cost">💎 ${h.cost}</div>`}
          </div>
          ${btnHtml}
        </div>
      `;
    }).join('');

    // Tapahtumakuuntelijat skineille
    shopSkinsList.querySelectorAll('.shop-btn.equip').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const skinId = e.target.getAttribute('data-skin');
        shopData.equippedSkin = skinId;
        saveShopData();
        Audio.play('skill');
        renderShop();
      });
    });

    shopSkinsList.querySelectorAll('.shop-btn.buy:not(.disabled)').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const skinId = e.target.getAttribute('data-skin');
        const s = SKINS.find(x => x.id === skinId);
        if (s && shopData.totalGems >= s.cost) {
          shopData.totalGems -= s.cost;
          shopData.ownedSkins.push(skinId);
          shopData.equippedSkin = skinId;
          saveShopData();
          Audio.play('gem');
          renderShop();
        }
      });
    });

    // Tapahtumakuuntelijat tavaroille
    shopItemsList.querySelectorAll('.shop-btn.buy:not(.disabled)').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const itemId = e.target.getAttribute('data-item');
        const item = ITEMS.find(x => x.id === itemId);
        if (item && shopData.totalGems >= item.cost) {
          shopData.totalGems -= item.cost;
          shopData.items[itemId] = (shopData.items[itemId] || 0) + 1;
          saveShopData();
          Audio.play('gem');
          renderShop();
        }
      });
    });

    // Tapahtumakuuntelijat asusteille
    shopHatsList.querySelectorAll('.shop-btn.equipped, .shop-btn.equip').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const hatId = e.target.getAttribute('data-hat');
        if (shopData.equippedHat === hatId) {
          shopData.equippedHat = 'none';
        } else {
          shopData.equippedHat = hatId;
        }
        saveShopData();
        Audio.play('skill');
        renderShop();
      });
    });

    shopHatsList.querySelectorAll('.shop-btn.buy:not(.disabled)').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const hatId = e.target.getAttribute('data-hat');
        const h = HATS.find(x => x.id === hatId);
        if (h && shopData.totalGems >= h.cost) {
          shopData.totalGems -= h.cost;
          shopData.ownedHats.push(hatId);
          shopData.equippedHat = hatId;
          saveShopData();
          Audio.play('gem');
          renderShop();
        }
      });
    });
  }

  function openShop() {
    renderShop();
    shopOverlay.classList.remove('hidden');
  }

  function closeShop() {
    shopOverlay.classList.add('hidden');
  }

  const CABIN_UPGRADES = [
    { id: 'fireplace', name: 'Tulisija 🔥', desc: 'Lataa Huskyn elämiä kun seisot sen lähellä mökissä. Taso 2 lataa nopeammin.', maxLvl: 2, cost: [10, 20] },
    { id: 'trophyWall', name: 'Palkintohylly 🏆', desc: 'Esittelee löytämäsi aarteet visualisoituina mökin seinällä. Antaa pysyvän +15% aloitus-XP-monistajan.', maxLvl: 1, cost: [15] },
    { id: 'doghouse', name: 'Koiranpeti 🛏️', desc: 'Lemmikkikaveri saa pehmeän petipaikan ja juoksee 20% kovempaa pelissä per taso.', maxLvl: 2, cost: [12, 24] },
    { id: 'bowlLvl', name: 'Ruokakuppi 🥣', desc: 'Ruokakuppi täynnä herkkuja. Antaa +20 XP joka tason alussa per taso.', maxLvl: 2, cost: [8, 16] }
  ];

  function renderCabinUpgrades() {
    cabinGemCount.textContent = shopData.totalGems;
    cabinGrid.innerHTML = CABIN_UPGRADES.map(upg => {
      const currentLvl = upg.id === 'trophyWall' 
        ? (shopData.cabinUpgrades[upg.id] ? 1 : 0)
        : (shopData.cabinUpgrades[upg.id] || 0);

      const maxed = currentLvl >= upg.maxLvl;
      const nextCost = maxed ? 0 : upg.cost[currentLvl];
      
      let btnHtml = '';
      if (maxed) {
        btnHtml = `<span class="owned-badge" style="color: #60ff60; font-weight: bold;">Maksimi! ✨</span>`;
      } else {
        const canAfford = shopData.totalGems >= nextCost;
        btnHtml = `
          <button class="shop-btn buy ${canAfford ? '' : 'disabled'}" data-id="${upg.id}" data-cost="${nextCost}" ${canAfford ? '' : 'disabled'}>
            Paranna: 💎 ${nextCost}
          </button>
        `;
      }

      return `
        <div class="shop-item">
          <div class="shop-item-info">
            <div class="shop-item-title">${upg.name} (Taso ${currentLvl}/${upg.maxLvl})</div>
            <div class="shop-item-desc">${upg.desc}</div>
          </div>
          ${btnHtml}
        </div>
      `;
    }).join('');

    // Päivityspainikkeiden kuuntelijat
    cabinGrid.querySelectorAll('.shop-btn.buy:not(.disabled)').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = btn.getAttribute('data-id');
        const cost = parseInt(btn.getAttribute('data-cost'));
        if (shopData.totalGems >= cost) {
          shopData.totalGems -= cost;
          if (id === 'trophyWall') {
            shopData.cabinUpgrades[id] = true;
          } else {
            shopData.cabinUpgrades[id] = (shopData.cabinUpgrades[id] || 0) + 1;
          }
          saveShopData();
          Audio.play('gem');
          renderCabinUpgrades();
        }
      });
    });
  }

  function openCabinUpgrades() {
    renderCabinUpgrades();
    cabinOverlay.classList.remove('hidden');
    running = false;
  }

  function closeCabinUpgrades() {
    cabinOverlay.classList.add('hidden');
    // Siirretään Huskya pois pöydän päältä
    husky.x += 62;
    resumeGame();
  }

  cabinCloseBtn.addEventListener('click', () => {
    closeCabinUpgrades();
  });

  startBtn.addEventListener('click', startGame);

  quitBtn.addEventListener('click', () => {
    Audio.unlock();
    if (confirm('Haluatko varmasti lopettaa nykyisen pelin ja palata alkuun?')) {
      gameOver();
    }
  });

  shopBtnOpen.addEventListener('click', () => {
    Audio.unlock();
    openShop();
  });

  shopCloseBtn.addEventListener('click', () => {
    closeShop();
  });

  const CODEX_PREY = [
    { id: 'rabbit', name: 'Jänis', emoji: '🐰', desc: 'Arka pitkäkorva. Juoksee nopeasti pakoon.' },
    { id: 'mouse', name: 'Hiiri', emoji: '🐭', desc: 'Pieni tuholainen. Liikkuu nopeasti ja vikkelästi.' },
    { id: 'squirrel', name: 'Orava', emoji: '🐿️', desc: 'Pörröhäntäinen kiipeilijä, viihtyy metsässä.' },
    { id: 'hedgehog', name: 'Siili', emoji: '🦔', desc: 'Piikikäs kulkija. Liikkuu melko hitaasti.' },
    { id: 'bird', name: 'Lintu', emoji: '🐦', desc: 'Mutkitteleva lentäjä, vaikea napattava.' },
    { id: 'deer', name: 'Hirvi', emoji: '🦌', desc: 'Uljas metsän kruunu. Erittäin nopea ja arka saalis.' },
    { id: 'beaver', name: 'Majava', emoji: '🦫', desc: 'Märkä uimari. Liikkuu vedessä ilman hidastuksia.' },
    { id: 'bat', name: 'Lepakko', emoji: '🦇', desc: 'Yötaivaan vikkelä kiitäjä. Ilmestyy vain pimeän tultua.' },
    { id: 'monkey', name: 'Apina', emoji: '🐒', desc: 'Viidakon ilkikurinen asukki. Tykkää varastaa luita koirilta!' },
    { id: 'mountain_goat', name: 'Vuorivuohi', emoji: '🐐', desc: 'Sumuvuorten kiipeilymestari. Juoksee kivien yli vaivattomasti.' },
  ];

  function openCodex() {
    renderCodex();
    codexOverlay.classList.remove('hidden');
  }

  function closeCodex() {
    codexOverlay.classList.add('hidden');
  }

  function renderCodex() {
    if (!shopData.discovered) shopData.discovered = {};
    codexGrid.innerHTML = CODEX_PREY.map(p => {
      const discovered = !!shopData.discovered[p.id];
      if (discovered) {
        return `
          <div class="codex-card discovered">
            <div class="codex-emoji">${p.emoji}</div>
            <div class="codex-name">${p.name}</div>
            <div class="codex-desc">${p.desc}</div>
          </div>
        `;
      } else {
        return `
          <div class="codex-card locked">
            <div class="codex-emoji">❓</div>
            <div class="codex-name">???</div>
            <div class="codex-desc">Löydä ja pyydystä tämä eläin seikkailulla avataksesi sen tiedot.</div>
          </div>
        `;
      }
    }).join('');
  }

  codexBtnOpen.addEventListener('click', () => {
    Audio.unlock();
    openCodex();
  });

  codexCloseBtn.addEventListener('click', () => {
    closeCodex();
  });

  const ACHIEVEMENTS = [
    { id: 'caught50', name: 'Suursaalistaja', desc: 'Pyydystä 50 saalista yhteensä', target: 50, reward: 10, icon: '🐿️' },
    { id: 'rescue3', name: 'Sankarikoira', desc: 'Pelasta 3 eksynyttä pentua', target: 3, reward: 15, icon: '🐾' },
    { id: 'noDamage', name: 'Varovainen vaeltaja', desc: 'Läpäise jokin taso ottamatta vahinkoa', target: 1, reward: 12, icon: '🛡️' },
    { id: 'visitCave', name: 'Luolaseikkailija', desc: 'Käy pimeässä luolassa', target: 1, reward: 8, icon: '🏮' }
  ];

  function checkAchievements() {
    if (!shopData.achievements) return;
    let updated = false;
    for (const ach of ACHIEVEMENTS) {
      if (shopData.achievements.unlocked.includes(ach.id)) continue;
      
      let progressVal = 0;
      if (ach.id === 'caught50') progressVal = shopData.achievements.caughtCount || 0;
      else if (ach.id === 'rescue3') progressVal = shopData.achievements.rescuedCount || 0;
      else if (ach.id === 'noDamage') progressVal = shopData.achievements.noDamageLevel ? 1 : 0;
      else if (ach.id === 'visitCave') progressVal = shopData.achievements.visitedCave ? 1 : 0;
      
      if (progressVal >= ach.target) {
        shopData.achievements.unlocked.push(ach.id);
        shopData.totalGems += ach.reward;
        showBanner(`🏆 Saavutus: ${ach.name}! +${ach.reward} 💎`);
        Audio.play('legendary');
        updated = true;
      }
    }
    if (updated) {
      saveShopData();
      renderAchievements();
    }
  }

  function renderAchievements() {
    const listEl = document.getElementById('achievements-list');
    if (!listEl) return;
    
    listEl.innerHTML = ACHIEVEMENTS.map(ach => {
      const isUnlocked = shopData.achievements.unlocked.includes(ach.id);
      let progressVal = 0;
      if (ach.id === 'caught50') progressVal = shopData.achievements.caughtCount || 0;
      else if (ach.id === 'rescue3') progressVal = shopData.achievements.rescuedCount || 0;
      else if (ach.id === 'noDamage') progressVal = shopData.achievements.noDamageLevel ? 1 : 0;
      else if (ach.id === 'visitCave') progressVal = shopData.achievements.visitedCave ? 1 : 0;
      
      let statusHtml = '';
      if (isUnlocked) {
        statusHtml = `<span class="reward-claimed font-bold">Saavutettu!<br>+${ach.reward} 💎</span>`;
      } else {
        statusHtml = `
          <span class="reward-badge">💎 ${ach.reward}</span>
          <span class="progress-text">${Math.min(progressVal, ach.target)}/${ach.target}</span>
        `;
      }
      
      return `
        <div class="achievement-card ${isUnlocked ? 'completed' : ''}">
          <div class="achievement-icon">${ach.icon}</div>
          <div class="achievement-details">
            <div class="achievement-name">${ach.name}</div>
            <div class="achievement-desc">${ach.desc}</div>
          </div>
          <div class="achievement-status">${statusHtml}</div>
        </div>
      `;
    }).join('');
  }

  // Näytä tallennetut ennätykset ja saavutukset jo aloitusruudussa
  renderHighScores(false);
  renderAchievements();
})();
