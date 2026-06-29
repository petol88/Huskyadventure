/*
 * sprites.js — Hahmojen grafiikka
 * Jokainen eläin piirretään käsin vektorigrafiikalla (ei kuvatiedostoja).
 * Hahmot piirretään katsoen oikealle; entiteetti kääntää ne (flip) ja
 * lisää kävelyanimaation animPhase-arvon perusteella.
 *
 * Kutsutaan: Sprites.draw(ctx, entity)
 * entity tarvitsee: x, y, radius, kind, flip (1/-1), animPhase, moving
 */

const Sprites = (() => {
  // --- Pienet apufunktiot ---

  function ellipse(ctx, cx, cy, rx, ry, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Pystysuunnassa varjostettu vartalo (vaalea ylhäällä, tumma alhaalla)
  function shadedEllipse(ctx, cx, cy, rx, ry, top, bottom) {
    const g = ctx.createLinearGradient(cx, cy - ry, cx, cy + ry);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(x, y, w, h, r);
    } else {
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
    }
  }

  // Animoitu jalka, joka heilahtaa kävellessä
  function leg(ctx, x, yTop, w, h, color, swing) {
    ctx.save();
    ctx.translate(x, yTop);
    ctx.rotate(swing);
    ctx.fillStyle = color;
    roundRect(ctx, -w / 2, 0, w, h, w / 2);
    ctx.fill();
    ctx.restore();
  }

  // Terävä korva (kolmio) pehmennetyin kärjin
  function ear(ctx, x, y, w, h, angle, outer, inner) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = outer;
    ctx.beginPath();
    ctx.moveTo(-w / 2, 0);
    ctx.quadraticCurveTo(0, -h * 1.1, w / 2, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = inner;
    ctx.beginPath();
    ctx.moveTo(-w / 4, -h * 0.1);
    ctx.quadraticCurveTo(0, -h * 0.7, w / 4, -h * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function eye(ctx, x, y, r, color = '#1a1a1a') {
    ellipse(ctx, x, y, r, r, color);
    // pieni kiilto
    ellipse(ctx, x - r * 0.3, y - r * 0.3, r * 0.35, r * 0.35, 'rgba(255,255,255,0.85)');
  }

  function groundShadow(ctx, r) {
    ellipse(ctx, 0, r * 0.95, r * 1.15, r * 0.35, 'rgba(0,0,0,0.18)');
  }

  // --- Husky (pelaaja) ---
  function husky(ctx, r, swing) {
    groundShadow(ctx, r);
    // Häntä (pörröinen, käppyrällä ylös takana)
    ctx.save();
    ctx.translate(-r * 1.05, -r * 0.2);
    shadedEllipse(ctx, 0, 0, r * 0.5, r * 0.42, '#f2f4f8', '#b9bdc9');
    ellipse(ctx, r * 0.1, -r * 0.05, r * 0.28, r * 0.24, '#9aa0b0');
    ctx.restore();
    // Takajalat (tummemmat)
    leg(ctx, -r * 0.55, r * 0.45, r * 0.34, r * 0.55, '#a7adba', swing * 0.6);
    // Vartalo
    shadedEllipse(ctx, 0, 0, r * 1.2, r * 0.82, '#eef0f5', '#c2c6d2');
    // Vaalea vatsa
    ellipse(ctx, r * 0.1, r * 0.35, r * 0.85, r * 0.4, '#fbfcff');
    // Etujalat (vaaleammat)
    leg(ctx, r * 0.6, r * 0.45, r * 0.34, r * 0.58, '#dfe2ea', -swing * 0.6);
    // Pää
    const hx = r * 0.95, hy = -r * 0.18;
    ear(ctx, hx - r * 0.35, hy - r * 0.55, r * 0.5, r * 0.6, -0.25, '#aab0c0', '#d98c9c');
    ear(ctx, hx + r * 0.35, hy - r * 0.55, r * 0.5, r * 0.6, 0.25, '#aab0c0', '#d98c9c');
    shadedEllipse(ctx, hx, hy, r * 0.72, r * 0.66, '#f4f6fa', '#d2d6e0');
    // Husky-naamio (tummempi otsa/poskialue)
    ctx.fillStyle = '#8b91a3';
    ctx.beginPath();
    ctx.moveTo(hx - r * 0.5, hy - r * 0.1);
    ctx.quadraticCurveTo(hx, hy - r * 0.75, hx + r * 0.5, hy - r * 0.1);
    ctx.quadraticCurveTo(hx + r * 0.2, hy + r * 0.1, hx, hy + r * 0.05);
    ctx.quadraticCurveTo(hx - r * 0.2, hy + r * 0.1, hx - r * 0.5, hy - r * 0.1);
    ctx.fill();
    // Kuono
    ellipse(ctx, hx + r * 0.55, hy + r * 0.18, r * 0.42, r * 0.32, '#fbfcff');
    ellipse(ctx, hx + r * 0.92, hy + r * 0.18, r * 0.12, r * 0.1, '#2a2a2e'); // nenä
    // Siniset husky-silmät
    eye(ctx, hx + r * 0.28, hy - r * 0.05, r * 0.13, '#4aa6e0');
  }

  // --- Jänis ---
  function rabbit(ctx, r, swing) {
    groundShadow(ctx, r);
    ellipse(ctx, -r * 0.95, r * 0.1, r * 0.28, r * 0.28, '#fbf3e6'); // pörröhäntä
    leg(ctx, -r * 0.4, r * 0.45, r * 0.3, r * 0.5, '#d9c7ad', swing * 0.5);
    shadedEllipse(ctx, 0, 0, r * 1.05, r * 0.78, '#efe3d0', '#d4c2a6');
    ellipse(ctx, r * 0.1, r * 0.32, r * 0.7, r * 0.34, '#fbf5ea');
    leg(ctx, r * 0.55, r * 0.45, r * 0.3, r * 0.52, '#e7d8c0', -swing * 0.5);
    const hx = r * 0.85, hy = -r * 0.3;
    // Pitkät korvat
    ear(ctx, hx - r * 0.18, hy - r * 0.7, r * 0.34, r * 1.15, -0.18, '#e7d8c0', '#f0b8c0');
    ear(ctx, hx + r * 0.22, hy - r * 0.7, r * 0.34, r * 1.15, 0.18, '#e7d8c0', '#f0b8c0');
    shadedEllipse(ctx, hx, hy, r * 0.58, r * 0.55, '#f2e8d8', '#dccbb0');
    ellipse(ctx, hx + r * 0.45, hy + r * 0.12, r * 0.1, r * 0.08, '#e89aa6'); // nenä
    eye(ctx, hx + r * 0.18, hy - r * 0.02, r * 0.11);
  }

  // --- Hiiri ---
  function mouse(ctx, r, swing) {
    groundShadow(ctx, r);
    // Pitkä häntä
    ctx.strokeStyle = '#e7a9b0';
    ctx.lineWidth = r * 0.12;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-r * 0.9, r * 0.1);
    ctx.quadraticCurveTo(-r * 1.6, -r * 0.3, -r * 1.3, -r * 0.8);
    ctx.stroke();
    leg(ctx, -r * 0.4, r * 0.4, r * 0.26, r * 0.45, '#9b958f', swing * 0.5);
    shadedEllipse(ctx, 0, 0, r * 1.0, r * 0.72, '#bdb7b2', '#928c87');
    ellipse(ctx, r * 0.1, r * 0.3, r * 0.65, r * 0.3, '#d8d3ce');
    leg(ctx, r * 0.5, r * 0.4, r * 0.26, r * 0.47, '#aaa49e', -swing * 0.5);
    const hx = r * 0.85, hy = -r * 0.18;
    // Suuret pyöreät korvat
    ellipse(ctx, hx - r * 0.3, hy - r * 0.45, r * 0.4, r * 0.4, '#a59f99');
    ellipse(ctx, hx - r * 0.3, hy - r * 0.45, r * 0.24, r * 0.24, '#f0b8c0');
    ellipse(ctx, hx + r * 0.3, hy - r * 0.5, r * 0.4, r * 0.4, '#a59f99');
    ellipse(ctx, hx + r * 0.3, hy - r * 0.5, r * 0.24, r * 0.24, '#f0b8c0');
    shadedEllipse(ctx, hx, hy, r * 0.55, r * 0.52, '#c4beb9', '#a09a95');
    ellipse(ctx, hx + r * 0.42, hy + r * 0.12, r * 0.1, r * 0.08, '#e89aa6');
    eye(ctx, hx + r * 0.18, hy, r * 0.1);
  }

  // --- Orava ---
  function squirrel(ctx, r, swing) {
    groundShadow(ctx, r);
    // Suuri pörröhäntä kaartuu selän yli
    ctx.save();
    ctx.translate(-r * 0.9, -r * 0.1);
    shadedEllipse(ctx, 0, -r * 0.4, r * 0.55, r * 0.95, '#d98a4e', '#9e5526');
    ellipse(ctx, 0, -r * 0.7, r * 0.36, r * 0.6, '#e9a868');
    ctx.restore();
    leg(ctx, -r * 0.35, r * 0.4, r * 0.28, r * 0.48, '#9e5526', swing * 0.5);
    shadedEllipse(ctx, 0, 0, r * 0.95, r * 0.74, '#c8743a', '#9e5526');
    ellipse(ctx, r * 0.15, r * 0.3, r * 0.6, r * 0.32, '#f0d8b8'); // vaalea vatsa
    leg(ctx, r * 0.5, r * 0.42, r * 0.28, r * 0.5, '#b5642e', -swing * 0.5);
    const hx = r * 0.85, hy = -r * 0.28;
    ear(ctx, hx - r * 0.22, hy - r * 0.5, r * 0.34, r * 0.5, -0.2, '#b5642e', '#e9a868');
    ear(ctx, hx + r * 0.22, hy - r * 0.5, r * 0.34, r * 0.5, 0.2, '#b5642e', '#e9a868');
    shadedEllipse(ctx, hx, hy, r * 0.56, r * 0.54, '#d07e44', '#a85c2c');
    ellipse(ctx, hx + r * 0.45, hy + r * 0.1, r * 0.1, r * 0.09, '#3a2a20');
    eye(ctx, hx + r * 0.2, hy - r * 0.04, r * 0.11);
  }

  // --- Siili ---
  function hedgehog(ctx, r, swing) {
    groundShadow(ctx, r);
    leg(ctx, -r * 0.3, r * 0.45, r * 0.24, r * 0.4, '#8a6a4a', swing * 0.4);
    leg(ctx, r * 0.35, r * 0.45, r * 0.24, r * 0.42, '#8a6a4a', -swing * 0.4);
    // Piikkikupu
    const g = ctx.createLinearGradient(0, -r * 0.8, 0, r * 0.6);
    g.addColorStop(0, '#7a6347');
    g.addColorStop(1, '#4f3f2c');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(-r * 0.1, -r * 0.05, r * 1.05, r * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();
    // Piikit
    ctx.fillStyle = '#3d3020';
    for (let i = 0; i < 11; i++) {
      const a = -Math.PI * 0.95 + (i / 10) * Math.PI * 0.9;
      const bx = -r * 0.1 + Math.cos(a) * r * 1.0;
      const by = -r * 0.05 + Math.sin(a) * r * 0.8;
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(-r * 0.1, 0);
      ctx.lineTo(r * 0.32, 0);
      ctx.lineTo(-r * 0.1, r * 0.16);
      ctx.fill();
      ctx.restore();
    }
    // Vaalea naama edessä
    const hx = r * 0.7, hy = r * 0.12;
    shadedEllipse(ctx, hx, hy, r * 0.5, r * 0.42, '#e8d4ba', '#c8ad8c');
    ellipse(ctx, hx + r * 0.42, hy + r * 0.05, r * 0.13, r * 0.11, '#2a2018'); // nenä
    eye(ctx, hx, hy - r * 0.05, r * 0.1);
  }

  // --- Karhu (peto) ---
  function bear(ctx, r, swing) {
    groundShadow(ctx, r);
    leg(ctx, -r * 0.55, r * 0.5, r * 0.42, r * 0.5, '#5e3a24', swing * 0.5);
    shadedEllipse(ctx, 0, 0, r * 1.18, r * 0.95, '#8a5a3a', '#5e3a24');
    leg(ctx, r * 0.6, r * 0.5, r * 0.42, r * 0.52, '#6b4226', -swing * 0.5);
    const hx = r * 0.92, hy = -r * 0.1;
    // Pyöreät korvat
    ellipse(ctx, hx - r * 0.4, hy - r * 0.55, r * 0.3, r * 0.3, '#6b4226');
    ellipse(ctx, hx - r * 0.4, hy - r * 0.55, r * 0.16, r * 0.16, '#caa074');
    ellipse(ctx, hx + r * 0.35, hy - r * 0.6, r * 0.3, r * 0.3, '#6b4226');
    ellipse(ctx, hx + r * 0.35, hy - r * 0.6, r * 0.16, r * 0.16, '#caa074');
    shadedEllipse(ctx, hx, hy, r * 0.72, r * 0.66, '#7e5234', '#5e3a24');
    // Kuono
    shadedEllipse(ctx, hx + r * 0.45, hy + r * 0.22, r * 0.42, r * 0.34, '#caa074', '#a07c50');
    ellipse(ctx, hx + r * 0.78, hy + r * 0.18, r * 0.14, r * 0.11, '#241812');
    // Pienet uhkaavat silmät
    eye(ctx, hx + r * 0.2, hy - r * 0.12, r * 0.1, '#1a1a1a');
    // Kulmakarva (vihaisuus)
    ctx.strokeStyle = '#3a2418';
    ctx.lineWidth = r * 0.08;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(hx - r * 0.05, hy - r * 0.32);
    ctx.lineTo(hx + r * 0.35, hy - r * 0.2);
    ctx.stroke();
  }

  // --- Susi (peto) ---
  function wolf(ctx, r, swing) {
    groundShadow(ctx, r);
    // Pörröhäntä
    ctx.save();
    ctx.translate(-r * 1.05, r * 0.05);
    shadedEllipse(ctx, 0, 0, r * 0.6, r * 0.4, '#5a5f6e', '#33384a');
    ellipse(ctx, -r * 0.2, 0, r * 0.28, r * 0.2, '#2b2f3e');
    ctx.restore();
    leg(ctx, -r * 0.55, r * 0.48, r * 0.36, r * 0.55, '#3c4150', swing * 0.6);
    shadedEllipse(ctx, 0, 0, r * 1.18, r * 0.82, '#5a5f6e', '#3c4150');
    ellipse(ctx, r * 0.1, r * 0.35, r * 0.8, r * 0.38, '#7a8090'); // vaaleampi vatsa
    leg(ctx, r * 0.6, r * 0.48, r * 0.36, r * 0.58, '#4a4f60', -swing * 0.6);
    const hx = r * 0.95, hy = -r * 0.15;
    ear(ctx, hx - r * 0.35, hy - r * 0.6, r * 0.5, r * 0.62, -0.25, '#4a4f60', '#2b2f3e');
    ear(ctx, hx + r * 0.35, hy - r * 0.6, r * 0.5, r * 0.62, 0.25, '#4a4f60', '#2b2f3e');
    shadedEllipse(ctx, hx, hy, r * 0.72, r * 0.64, '#5e6373', '#42475a');
    // Vaalea kuono
    ellipse(ctx, hx + r * 0.5, hy + r * 0.2, r * 0.42, r * 0.3, '#8a90a0');
    ellipse(ctx, hx + r * 0.88, hy + r * 0.18, r * 0.13, r * 0.1, '#15171f'); // nenä
    // Keltaiset pedon silmät
    eye(ctx, hx + r * 0.25, hy - r * 0.08, r * 0.12, '#e8c64a');
    ellipse(ctx, hx + r * 0.25, hy - r * 0.08, r * 0.05, r * 0.05, '#1a1a1a'); // pupilli
  }

  // --- Lintu (saalis) — nopea ja kepeä ---
  function bird(ctx, r, swing) {
    groundShadow(ctx, r * 0.8);
    // Pyrstö
    ctx.fillStyle = '#3a7fc0';
    ctx.beginPath();
    ctx.moveTo(-r * 0.7, -r * 0.1);
    ctx.lineTo(-r * 1.3, -r * 0.4);
    ctx.lineTo(-r * 1.25, r * 0.25);
    ctx.closePath();
    ctx.fill();
    // Vartalo
    shadedEllipse(ctx, 0, 0, r * 0.9, r * 0.72, '#6ab0ec', '#3f86cf');
    ellipse(ctx, r * 0.05, r * 0.28, r * 0.6, r * 0.32, '#dff0ff'); // vaalea rinta
    // Siipi (räpyttää swingin mukaan)
    ctx.save();
    ctx.translate(-r * 0.05, -r * 0.1);
    ctx.rotate(swing * 0.5);
    ellipse(ctx, 0, 0, r * 0.55, r * 0.3, '#3a7fc0');
    ctx.restore();
    // Pää
    const hx = r * 0.7, hy = -r * 0.25;
    shadedEllipse(ctx, hx, hy, r * 0.5, r * 0.48, '#6ab0ec', '#4a90d8');
    // Nokka
    ctx.fillStyle = '#f0a838';
    ctx.beginPath();
    ctx.moveTo(hx + r * 0.35, hy);
    ctx.lineTo(hx + r * 0.85, hy + r * 0.08);
    ctx.lineTo(hx + r * 0.35, hy + r * 0.22);
    ctx.closePath();
    ctx.fill();
    eye(ctx, hx + r * 0.1, hy - r * 0.02, r * 0.1);
  }

  // --- Kettu (peto) — nopea, kapea mutta pitkä näkökenttä ---
  function fox(ctx, r, swing) {
    groundShadow(ctx, r);
    // Pörröhäntä valkoisella kärjellä
    ctx.save();
    ctx.translate(-r * 1.05, r * 0.05);
    shadedEllipse(ctx, 0, 0, r * 0.62, r * 0.42, '#e07b2a', '#b85a1e');
    ellipse(ctx, -r * 0.35, 0, r * 0.3, r * 0.26, '#f5ede0'); // valkoinen kärki
    ctx.restore();
    leg(ctx, -r * 0.5, r * 0.5, r * 0.3, r * 0.5, '#9e4e18', swing * 0.6);
    shadedEllipse(ctx, 0, 0, r * 1.12, r * 0.74, '#e07b2a', '#b85a1e');
    ellipse(ctx, r * 0.1, r * 0.34, r * 0.78, r * 0.34, '#f5ede0'); // valkoinen vatsa
    leg(ctx, r * 0.55, r * 0.5, r * 0.3, r * 0.52, '#c4691f', -swing * 0.6);
    const hx = r * 0.92, hy = -r * 0.18;
    // Terävät korvat
    ear(ctx, hx - r * 0.3, hy - r * 0.55, r * 0.42, r * 0.6, -0.25, '#c4691f', '#2b2018');
    ear(ctx, hx + r * 0.3, hy - r * 0.58, r * 0.42, r * 0.6, 0.25, '#c4691f', '#2b2018');
    shadedEllipse(ctx, hx, hy, r * 0.62, r * 0.56, '#e07b2a', '#bf631f');
    // Valkoiset posket + kuono
    ellipse(ctx, hx + r * 0.45, hy + r * 0.22, r * 0.46, r * 0.3, '#f5ede0');
    ellipse(ctx, hx + r * 0.82, hy + r * 0.2, r * 0.12, r * 0.1, '#1a1410'); // nenä
    // Terävä keltainen silmä
    eye(ctx, hx + r * 0.2, hy - r * 0.06, r * 0.12, '#f0c040');
    ellipse(ctx, hx + r * 0.2, hy - r * 0.06, r * 0.05, r * 0.07, '#1a1a1a'); // kapea pupilli
  }

  const drawers = { husky, rabbit, mouse, squirrel, hedgehog, bear, wolf, bird, fox };

  function draw(ctx, e) {
    const fn = drawers[e.kind];
    if (!fn) return;
    // Kävelyn heilahdus jaloille + kevyt pomppu
    const swing = e.moving ? Math.sin(e.animPhase) * 0.5 : 0;
    const bob = e.moving ? Math.sin(e.animPhase * 2) * 1.2 : 0;
    ctx.save();
    ctx.translate(e.x, e.y + bob);
    if (e.flip < 0) ctx.scale(-1, 1); // käännä vasemmalle mentäessä
    if (e.scale) ctx.scale(e.scale, e.scale); // pomot piirretään isompina
    fn(ctx, e.radius, swing);
    ctx.restore();
  }

  // --- Keräiltävä luu (ja kultainen luu) ---
  function drawBone(ctx, x, y, r, gold, bob) {
    ctx.save();
    ctx.translate(x, y + bob);
    if (gold) {
      // Kultainen hehku
      ctx.shadowColor = 'rgba(255,210,80,0.9)';
      ctx.shadowBlur = 14;
    }
    const g = ctx.createLinearGradient(0, -r, 0, r);
    if (gold) { g.addColorStop(0, '#ffe680'); g.addColorStop(1, '#e0a020'); }
    else { g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#d8d2c4'); }
    ctx.fillStyle = g;
    ctx.strokeStyle = gold ? '#a6730c' : '#b8b0a0';
    ctx.lineWidth = 1.5;
    // Varsi
    const len = r * 1.4, w = r * 0.5;
    roundRect(ctx, -len / 2, -w / 2, len, w, w / 2);
    ctx.fill(); ctx.stroke();
    // Päiden nystyt
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(sx * len / 2, sy * r * 0.42, r * 0.42, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
      }
    }
    ctx.restore();
  }

  return { draw, drawBone };
})();
