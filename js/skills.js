/*
 * skills.js — Huskyn taidot (perks)
 * Jokainen taito muokkaa "perks"-oliota, jonka game.js välittää hahmoille.
 * apply(perks, api): perks = kertyvät muokkaimet, api = pelin pikkurajapinta
 * (esim. api.gainLife). max = montako kertaa taidon voi ottaa.
 */

const Skills = (() => {
  const ALL = [
    {
      id: 'swift', name: 'Nopeat tassut', emoji: '💨', max: 5,
      desc: 'Liikkumisnopeus +12 %',
      apply: (p) => { p.speedMul *= 1.12; },
    },
    {
      id: 'catcher', name: 'Saalistaja', emoji: '🎯', max: 5,
      desc: 'Pyydystä saalis kauempaa',
      apply: (p) => { p.catchBonus += 9; },
    },
    {
      id: 'stealth', name: 'Hiljaiset askeleet', emoji: '🤫', max: 5,
      desc: 'Pedot huomaavat sinut lähempää (-12 %)',
      apply: (p) => { p.detectionMul *= 0.88; },
    },
    {
      id: 'hunter', name: 'Vaaniva', emoji: '👀', max: 5,
      desc: 'Saalis huomaa sinut myöhemmin (-15 %)',
      apply: (p) => { p.preyFleeMul *= 0.85; },
    },
    {
      id: 'tough', name: 'Sisukas', emoji: '❤️', max: 3,
      desc: '+1 elämä (ja suurempi maksimi)',
      apply: (p, api) => { api.gainLife(); },
    },
    {
      id: 'sprint', name: 'Kirmaus', emoji: '⚡', max: 1,
      desc: 'Pidä Vaihto / ⚡-painike pohjassa juostaksesi hetken nopeammin',
      apply: (p) => { p.hasSprint = true; },
    },
    {
      id: 'bushmaster', name: 'Pensasmestari', emoji: '🌿', max: 1,
      desc: 'Liiku pusikoissa täydellä vauhdilla (+30 %)',
      apply: (p) => { p.bushSpeed = true; },
    },
    {
      id: 'howl', name: 'Ulvonta', emoji: '🐺', max: 3,
      desc: 'Välilyönti / 🐺: pelästytä lähellä olevat pedot pakoon',
      apply: (p) => { p.hasHowl = true; p.howlPower += 1; },
    },
  ];

  function byId(id) { return ALL.find((s) => s.id === id); }

  // Aloitusarvot kaikille muokkaimille
  function freshPerks() {
    return {
      speedMul: 1,
      catchBonus: 0,
      detectionMul: 1, // pedon näköetäisyyteen
      preyFleeMul: 1,  // saaliin pakoetäisyyteen
      hasSprint: false,
      bushSpeed: false,
      hasHowl: false,
      howlPower: 0,    // montako kertaa Ulvonta otettu (säde + jäähdytys)
      hasShield: false, // Muinainen kilpi -artefakti
      taken: {},       // id -> montako kertaa otettu
    };
  }

  // Arvo "count" satunnaista taitoa, joita voi vielä ottaa (max ei täynnä)
  function roll(taken, count) {
    const avail = ALL.filter((s) => (taken[s.id] || 0) < (s.max || Infinity));
    for (let i = avail.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [avail[i], avail[j]] = [avail[j], avail[i]];
    }
    return avail.slice(0, count);
  }

  return { ALL, byId, freshPerks, roll };
})();
