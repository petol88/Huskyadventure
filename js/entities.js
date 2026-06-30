/*
 * entities.js — Pelin hahmot
 * Husky (pelaaja), Prey (saaliseläin) ja Predator (peto näkökentällä).
 * Hahmojen logiikka on täällä; ulkoasun piirtää js/sprites.js
 * (Sprites.draw) lajinimen (kind) perusteella.
 */

// Apufunktio: rajaa arvo väliin
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

// Leikkaako jana (x1,y1)->(x2,y2) ympyrän (cx,cy,r)?
// Käytetään näköyhteyden (line-of-sight) katkaisemiseen esteillä.
function segmentHitsCircle(x1, y1, x2, y2, cx, cy, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  // Janan lähin piste ympyrän keskipisteeseen (parametri t välillä 0..1)
  let t = lenSq > 0 ? ((cx - x1) * dx + (cy - y1) * dy) / lenSq : 0;
  t = clamp(t, 0, 1);
  const px = x1 + t * dx;
  const py = y1 + t * dy;
  return Math.hypot(px - cx, py - cy) < r;
}

// --- Obstacle: este (pusikko tai kivi) ---
class Obstacle {
  constructor(x, y, radius, type = 'bush') {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.type = type; // 'bush', 'rock', 'mud', 'ice', 'cactus'
  }

  get solid() {
    return this.type === 'rock' || this.type === 'cactus';
  }

  get blocksSight() {
    return this.type === 'rock' || this.type === 'bush' || this.type === 'cactus';
  }

  // pal = biomin paletti { rockFill, rockStroke, bushFill, bushEmoji }
  draw(ctx, pal = {}) {
    if (this.type === 'rock') {
      ctx.fillStyle = pal.rockFill || '#6b6b72';
      ctx.strokeStyle = pal.rockStroke || '#4a4a50';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (this.type === 'bush') {
      // Pusikko: pehmeä läiskä + biomin tunnusmerkki
      ctx.fillStyle = pal.bushFill || '#2e7d32';
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = `${this.radius * 1.4}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pal.bushEmoji || '🌳', this.x, this.y);
    } else if (this.type === 'mud') {
      // Muta: ruskea epäsäännöllinen lammikko
      ctx.fillStyle = '#4a3319';
      ctx.beginPath();
      ctx.ellipse(this.x, this.y, this.radius * 1.25, this.radius * 0.85, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = `${this.radius * 0.8}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🤎', this.x, this.y);
    } else if (this.type === 'ice') {
      // Jää: vaaleansininen lammikko kiillolla
      ctx.fillStyle = 'rgba(180, 225, 255, 0.4)';
      ctx.strokeStyle = '#cceeff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(this.x, this.y, this.radius * 1.25, this.radius * 0.85, -0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.font = `${this.radius * 0.8}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('❄️', this.x, this.y);
    } else if (this.type === 'cactus') {
      // Kaktus
      ctx.fillStyle = '#2e7d32';
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = `${this.radius * 1.3}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🌵', this.x, this.y);
    } else if (this.type === 'lava') {
      // Laavaläiskä: hehkuva oranssi lätäkkö keltaisella reunalla
      ctx.fillStyle = '#ff5a00';
      ctx.strokeStyle = '#ffe000';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(this.x, this.y, this.radius * 1.25, this.radius * 0.85, 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.font = `${this.radius * 0.7}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🔥', this.x, this.y);
    } else if (this.type === 'water') {
      // Vesi: sininen lätäkkö
      ctx.fillStyle = 'rgba(30, 144, 255, 0.45)';
      ctx.strokeStyle = '#1e90ff';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.ellipse(this.x, this.y, this.radius * 1.3, this.radius * 0.9, 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.font = `${this.radius * 0.8}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('💧', this.x, this.y);
    }
  }
}

// --- Husky: pelaajan ohjaama hahmo ---
class Husky {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 18;
    this.speed = 230; // pikseliä sekunnissa
    this.facing = 0;  // suunta radiaaneina (katsesuunta)
    this.hidden = false; // onko pusikossa piilossa
    this.kind = 'husky';
    this.flip = 1;       // 1 = oikealle, -1 = vasemmalle
    this.animPhase = 0;  // kävelyanimaation vaihe
    this.moving = false;
    this.stamina = 1;    // sprintin energia 0..1
    this.sprinting = false;
    this.howlCd = 0;     // ulvonnan jäähdytysaika (s jäljellä)
    this.howlMax = 6;    // jäähdytyksen kokonaiskesto (game.js säätää taitojen mukaan)
    this.shieldReady = true; // Muinaisen kilven suoja valmiina (jos artefakti hankittu)
    this.shieldCd = 0;       // kilven latautumisaika (s jäljellä)
    this.vx = 0;             // fysiikan nopeudet jäämekaniikkaan
    this.vy = 0;
    this.inWater = false;    // uimismekaniikka
    this.slowTimer = 0;      // lumipallohidastus
  }

  update(dt, dir, world, obstacles = [], perks = {}, sprintHeld = false, season = 'spring') {
    if (this.howlCd > 0) this.howlCd -= dt;
    // Muinaisen kilven latautuminen
    if (perks.hasShield && !this.shieldReady) {
      this.shieldCd -= dt;
      if (this.shieldCd <= 0) this.shieldReady = true;
    }

    // Nopeus: peruskerroin + pensasmestari + sprintti
    let spd = this.speed * (perks.speedMul || 1);
    if (perks.bushSpeed && this.hidden) spd *= 1.3;
    if (perks.isOverheating) spd *= 0.76;

    if (this.slowTimer > 0) {
      this.slowTimer -= dt;
      spd *= 0.55;
    }

    this.sprinting = false;
    const inputMoving = dir.x !== 0 || dir.y !== 0;
    if (perks.hasSprint) {
      if (sprintHeld && inputMoving && this.stamina > 0.02) {
        this.sprinting = true;
        spd *= 1.8;
        const stamCost = perks.isOverheating ? 1.25 : 0.7;
        this.stamina = Math.max(0, this.stamina - dt * stamCost);
      } else {
        this.stamina = Math.min(1, this.stamina + dt * 0.35); // täyttyy ~2.8 s
      }
    }

    // Tarkistetaan maastovaikutukset (esteistä)
    let inMud = false;
    let onIce = (season === 'winter');
    let inWater = false;
    for (const o of obstacles) {
      const dist = Math.hypot(this.x - o.x, this.y - o.y);
      if (o.type === 'mud' && dist < o.radius) inMud = true;
      if (o.type === 'ice' && dist < o.radius) onIce = true;
      if (o.type === 'water' && dist < o.radius) inWater = true;
    }

    if (inMud) spd *= 0.65; // Muta hidastaa Huskya
    if (inWater) spd *= 0.5; // Vesi hidastaa Huskya (uiminen)
    this.inWater = inWater;

    const targetVx = dir.x * spd;
    const targetVy = dir.y * spd;

    if (onIce) {
      // Liukas jää: nopeus muuttuu vähitellen (kitkaton liuku)
      const accel = 1.7;
      this.vx += (targetVx - this.vx) * accel * dt;
      this.vy += (targetVy - this.vy) * accel * dt;
    } else {
      this.vx = targetVx;
      this.vy = targetVy;
    }

    const currentSpeed = Math.hypot(this.vx, this.vy);
    this.moving = inputMoving || currentSpeed > 15;

    if (this.moving) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (currentSpeed > 5) {
        this.facing = Math.atan2(this.vy, this.vx);
        this.flip = this.vx < 0 ? -1 : 1;
      }
      this.animPhase += dt * (this.sprinting ? 20 : 12);
    }

    // Pidä kentän sisällä
    this.x = clamp(this.x, this.radius, world.width - this.radius);
    this.y = clamp(this.y, this.radius, world.height - this.radius);

    // Törmäys kiinteisiin esteisiin (kivet): työnnä ulos
    this.hidden = false;
    for (const o of obstacles) {
      const dist = Math.hypot(this.x - o.x, this.y - o.y);
      if (o.solid && dist < this.radius + o.radius && dist > 0) {
        const overlap = this.radius + o.radius - dist;
        this.x += ((this.x - o.x) / dist) * overlap;
        this.y += ((this.y - o.y) / dist) * overlap;
      }
      // Pusikon tai lehtikasan sisällä = piilossa
      if ((o.type === 'bush' || o.type === 'leafpile') && dist < o.radius) {
        this.hidden = true;
      }
    }
  }

  draw(ctx) {
    ctx.save();
    // Piilossa ollessa husky on läpikuultava
    if (this.hidden) ctx.globalAlpha = 0.45;
    Sprites.draw(ctx, this);
    ctx.restore();
  }
}

// --- Prey: pieni saaliseläin joka pakenee huskyä ---
class Prey {
  constructor(x, y, kind = 'rabbit') {
    this.x = x;
    this.y = y;
    this.radius = (kind === 'deer' || kind === 'mountain_goat') ? 17 : (kind === 'monkey' ? 14 : 13);
    this.kind = kind;
    // Lajikohtaiset ominaisuudet tuovat vaihtelua
    const stats = {
      rabbit:   { speed: 155, fleeDist: 150 },
      mouse:    { speed: 112, fleeDist: 118 },
      squirrel: { speed: 145, fleeDist: 140 },
      hedgehog: { speed: 92,  fleeDist: 100 },
      bird:     { speed: 172, fleeDist: 165 },
      deer:     { speed: 205, fleeDist: 210 },
      beaver:   { speed: 125, fleeDist: 130 },
      bat:      { speed: 182, fleeDist: 180 },
      monkey:   { speed: 168, fleeDist: 155 },
      mountain_goat: { speed: 178, fleeDist: 160 },
    };
    const s = stats[kind] || stats.rabbit;
    this.speed = s.speed;
    this.fleeDist = s.fleeDist;
    this.alive = true;
    this.erratic = kind === 'bird' || kind === 'bat' || kind === 'monkey';
    this.stolenBones = 0;
    this.zigTimer = 0;
    this.zigSign = 1;
    this.flip = 1;
    this.animPhase = 0;
    this.moving = false;
  }

  update(dt, husky, world, obstacles = [], perks = {}) {
    const dx = this.x - husky.x;
    const dy = this.y - husky.y;
    const dist = Math.hypot(dx, dy);
    const fleeDist = this.fleeDist * (perks.preyFleeMul || 1);

    // Tarkistetaan maastovaikutukset (vedessä uiminen hidastaa, paitsi majavaa ja lintuja/lepakkoja)
    let inWater = false;
    let inMud = false;
    if (this.kind !== 'bird' && this.kind !== 'bat') {
      for (const o of obstacles) {
        const d = Math.hypot(this.x - o.x, this.y - o.y);
        if (o.type === 'water' && d < o.radius) inWater = true;
        if (o.type === 'mud' && d < o.radius) inMud = true;
      }
    }
    let speedScale = 1.0;
    if (inMud) speedScale *= 0.65;
    if (inWater && this.kind !== 'beaver') speedScale *= 0.5; // majava ui vapaasti

    this.moving = false;
    if (dist < fleeDist && dist > 0) {
      // Pakene huskystä poispäin
      let vx = dx / dist;
      let vy = dy / dist;
      // Lintu mutkittelee: lisää kohtisuora heilahdus joka vaihtaa suuntaa
      if (this.erratic) {
        this.zigTimer -= dt;
        if (this.zigTimer <= 0) { this.zigSign *= -1; this.zigTimer = 0.35 + Math.random() * 0.3; }
        vx += -vy * 0.7 * this.zigSign;
        vy += dx / dist * 0.7 * this.zigSign;
      }
      const vlen = Math.hypot(vx, vy) || 1;
      this.x += (vx / vlen) * this.speed * speedScale * dt;
      this.y += (vy / vlen) * this.speed * speedScale * dt;
      this.moving = true;
      this.flip = vx < 0 ? -1 : 1;
      this.animPhase += dt * (this.erratic ? 24 : 16);
    }
    this.x = clamp(this.x, this.radius, world.width - this.radius);
    this.y = clamp(this.y, this.radius, world.height - this.radius);
  }

  draw(ctx) {
    Sprites.draw(ctx, this);
  }
}

// --- Predator: iso peto jolla on näkökenttä ---
class Predator {
  constructor(x, y, kind = 'bear', speedMul = 1, isBoss = false) {
    this.x = x;
    this.y = y;
    this.kind = kind;
    this.isBoss = isBoss;
    // Lajikohtaiset ominaisuudet: karhu hidas/leveä, susi ketterä, kettu nopea/kapea, pöllö yöpeto, yeti/skorpioni/krokotiili pomot
    const stats = {
      bear: { radius: 26, patrol: 70, chase: 195, view: 215, angle: Math.PI / 3 },
      wolf: { radius: 26, patrol: 76, chase: 211, view: 230, angle: Math.PI / 3 },
      fox:  { radius: 20, patrol: 90, chase: 224, view: 265, angle: Math.PI / 4.5 },
      lynx: { radius: 22, patrol: 72, chase: 245, view: 170, angle: Math.PI / 3.2 },
      eagle: { radius: 18, patrol: 100, chase: 260, view: 380, angle: Math.PI },
      owl:  { radius: 21, patrol: 85, chase: 220, view: 320, angle: Math.PI },
      yeti: { radius: 36, patrol: 65, chase: 205, view: 240, angle: Math.PI / 2.5 },
      scorpion: { radius: 34, patrol: 75, chase: 215, view: 250, angle: Math.PI / 3 },
      crocodile: { radius: 32, patrol: 70, chase: 210, view: 230, angle: Math.PI / 3.2 },
      panther: { radius: 24, patrol: 85, chase: 252, view: 185, angle: Math.PI / 3.0 },
    };
    const s = stats[kind] || stats.bear;
    // Pomo on isompi, hieman nopeampi ja näkee laajemmalti
    const bossSpd = isBoss ? 1.06 : 1;
    this.radius = s.radius * (isBoss ? 1.4 : 1);
    this.patrolSpeed = s.patrol * speedMul * bossSpd;
    this.chaseSpeed = s.chase * speedMul * bossSpd;
    this.viewDist = s.view * (isBoss ? 1.3 : 1);
    this.viewAngle = isBoss ? Math.PI / 2.5 : s.angle;
    this.flip = 1;
    this.animPhase = 0;
    this.moving = false;
    this.facing = Math.random() * Math.PI * 2;
    this.state = (kind === 'lynx' || kind === 'panther') ? 'ambush' : 'patrol';        // 'patrol', 'chase', 'alert', 'flee', 'ambush'
    this.hidden = (kind === 'lynx' || kind === 'panther'); // Väijyjät piilossa alussa
    this.wanderTimer = 0;
    this.scareTimer = 0;          // pelästyksen kesto (s jäljellä, huskyn ulvonnasta)
    this.alertTimer = 0;          // kuinka kauan tutkii viimeistä havaintoa
    this.alertMax = 2.6;
    this.lastSeen = { x, y };     // viimeisin huskyn havaintopaikka
    this.ambushLeapTimer = 0;     // ilveksen syöksy
    this.heightOffset = (kind === 'eagle' || kind === 'owl') ? 60 : 0; // lentävät suuret pedot
    this.shootCd = 0;             // Yeti ja skorpioni hyökkäysajastin
    this.lungeTimer = 0;          // krokotiilin lisäsyöksy
    // Pomon syöksyhyökkäys
    this.chargeState = 'none';    // 'none' | 'windup' | 'lunge' | 'recover'
    this.chargeTimer = 0;
    this.chargeCd = 2.5;          // alkujäähdytys ennen ensimmäistä syöksyä
    this.chargeDir = { x: 1, y: 0 };
    if (isBoss) {
      this.maxHp = 3;
      this.hp = 3;
    }
  }

  // Pelästytä peto: pakenee huskystä annetun ajan.
  // Pomo pökertyy ulvonnasta (keskeyttää hyökkäyksen).
  scare(duration) {
    if (this.isBoss) {
      this.chargeState = 'recover';
      this.chargeTimer = 3.2; // pökertynyt / alttiina iskulle
      this.chargeCd = 5.0;
      this.state = 'patrol';
    } else {
      this.scareTimer = Math.max(this.scareTimer, duration);
    }
  }

  // Pomon syöksyhyökkäys: lataus → syöksy → toipuminen.
  // Palauttaa true kun syöksy on aktiivinen (ohittaa tavallisen tekoälyn).
  updateCharge(dt, husky, world, obstacles, perks, envMul = 1) {
    if (this.chargeCd > 0) this.chargeCd -= dt;

    if (this.chargeState === 'none') {
      // Aloita lataus jos näkee huskyn, on jäähtynyt eikä pelästynyt
      const dist = Math.hypot(husky.x - this.x, husky.y - this.y);
      if (this.scareTimer <= 0 && this.chargeCd <= 0 && dist > 60 && dist < 430 &&
          this.canSee(husky, obstacles, perks, envMul)) {
        this.chargeState = 'windup';
        this.chargeTimer = 0.7;
        this.state = 'chase';
        return true; // siirry heti telegraphiin
      }
      return false; // anna tavallisen tekoälyn pyöriä
    }

    if (this.chargeState === 'windup') {
      // Seisoo paikallaan ja tähtää huskyyn (telegraph)
      this.chargeTimer -= dt;
      const a = Math.atan2(husky.y - this.y, husky.x - this.x);
      this.facing = a;
      this.chargeDir = { x: Math.cos(a), y: Math.sin(a) };
      this.moving = false;
      this.flip = Math.cos(a) < 0 ? -1 : 1;
      if (this.chargeTimer <= 0) { this.chargeState = 'lunge'; this.chargeTimer = 0.45; }
      return true;
    }

    if (this.chargeState === 'lunge') {
      // Syöksyy suoraan tallennettuun suuntaan suurella nopeudella
      this.chargeTimer -= dt;
      let spd = this.chaseSpeed * 2.6;
      if (this.kind === 'crocodile') spd = this.chaseSpeed * 3.6; // krokotiili syöksyy äärimmäisen nopeasti!
      this.x += this.chargeDir.x * spd * dt;
      this.y += this.chargeDir.y * spd * dt;
      this.moving = true;
      this.animPhase += dt * 22;
      this.flip = this.chargeDir.x < 0 ? -1 : 1;
      
      const hit = this.resolveBounds(world, obstacles);
      
      let hitLava = false;
      for (const o of obstacles) {
        if (o.type === 'lava' && Math.hypot(this.x - o.x, this.y - o.y) < this.radius + o.radius * 0.7) {
          hitLava = true;
        }
      }

      // Osuma seinään/kiveen/laavaan → tyrmääntyy
      if (hit || hitLava || this.chargeTimer <= 0) {
        this.chargeState = 'recover';
        const crashed = hit || hitLava;
        this.chargeTimer = crashed ? 4.2 : 0.9; // pidempi stunni osumasta!
        this.chargeCd = crashed ? 5.5 : 3.5;
        
        if (crashed && this.isBoss) {
          this.hp = (this.hp || 3) - 1;
          if (window.onBossDamage) {
            window.onBossDamage(this, hitLava ? 'lava' : 'solid');
          }
        }
      }
      return true;
    }

    // recover: toipuu hitaasti, ajelehtii huskya kohti
    this.chargeTimer -= dt;
    const a = Math.atan2(husky.y - this.y, husky.x - this.x);
    this.facing = a;
    this.flip = Math.cos(a) < 0 ? -1 : 1;
    this.moving = true;
    this.animPhase += dt * 5;
    this.x += Math.cos(a) * this.patrolSpeed * 0.4 * dt;
    this.y += Math.sin(a) * this.patrolSpeed * 0.4 * dt;
    this.resolveBounds(world, obstacles);
    if (this.chargeTimer <= 0) this.chargeState = 'none';
    return true;
  }

  // Näkeekö peto huskyn? (piiloutuminen + etäisyys + kulma + näköeste).
  // envMul = ympäristön näkyvyyskerroin (yö/sää heikentää).
  canSee(husky, obstacles = [], perks = {}, envMul = 1) {
    // Pusikossa piilossa → ei näy
    if (husky.hidden) return false;

    const dx = husky.x - this.x;
    const dy = husky.y - this.y;
    const dist = Math.hypot(dx, dy);
    const viewDist = this.viewDist * (perks.detectionMul || 1) * envMul;
    if (dist > viewDist) return false;

    const angleTo = Math.atan2(dy, dx);
    let diff = Math.abs(angleTo - this.facing);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    if (diff >= this.viewAngle) return false;

    // Näköyhteys katkeaa jos este on pedon ja huskyn välissä (paitsi lentävillä)
    if (this.kind !== 'eagle' && this.kind !== 'owl') {
      for (const o of obstacles) {
        if (o.blocksSight && segmentHitsCircle(this.x, this.y, husky.x, husky.y, o.x, o.y, o.radius)) {
          return false;
        }
      }
    }
    return true;
  }

  updateShooting(dt, husky, spawnedProjectiles) {
    if (this.shootCd > 0) {
      this.shootCd -= dt;
      return;
    }
    const dist = Math.hypot(husky.x - this.x, husky.y - this.y);
    if (dist < 460) {
      const ang = Math.atan2(husky.y - this.y, husky.x - this.x);
      const projSpeed = this.kind === 'yeti' ? 240 : 320;
      const type = this.kind === 'yeti' ? 'snowball' : 'sting';
      const radius = this.kind === 'yeti' ? 12 : 9;
      spawnedProjectiles.push({
        x: this.x + Math.cos(ang) * this.radius,
        y: this.y + Math.sin(ang) * this.radius,
        vx: Math.cos(ang) * projSpeed,
        vy: Math.sin(ang) * projSpeed,
        type: type,
        radius: radius,
        timer: 3.0,
        maxTime: 3.0
      });
      this.shootCd = 1.6 + Math.random() * 1.0;
      if (typeof Audio !== 'undefined') Audio.play('catch');
    }
  }

  update(dt, husky, world, obstacles = [], perks = {}, envMul = 1, spawnedProjectiles = [], isNight = false) {
    // Pomon syöksyhyökkäys ohittaa tavallisen tekoälyn kun aktiivinen
    if (this.isBoss && this.updateCharge(dt, husky, world, obstacles, perks, envMul)) {
      if (this.chargeState !== 'recover' && (this.kind === 'yeti' || this.kind === 'scorpion')) {
        this.updateShooting(dt, husky, spawnedProjectiles);
      }
      return;
    }

    // Päivitä ampuminen (Yeti & Skorpioni)
    if (this.isBoss && (this.kind === 'yeti' || this.kind === 'scorpion')) {
      this.updateShooting(dt, husky, spawnedProjectiles);
    }

    // Tarkistetaan maastovaikutukset (vedessä uiminen hidastaa, paitsi lentävillä)
    let inWater = false;
    let inMud = false;
    if (this.kind !== 'eagle' && this.kind !== 'owl') {
      for (const o of obstacles) {
        const d = Math.hypot(this.x - o.x, this.y - o.y);
        if (o.type === 'water' && d < o.radius) inWater = true;
        if (o.type === 'mud' && d < o.radius) inMud = true;
      }
    }
    let speedScale = 1.0;
    if (inMud) speedScale *= 0.65;
    if (inWater) speedScale *= 0.55;
    if (isNight && this.state === 'chase') speedScale *= 1.15;

    // Tilakoneen päätös
    if (this.scareTimer > 0) {
      // Pelästys (ulvonta) ohittaa muun tekoälyn
      this.scareTimer -= dt;
      this.state = 'flee';
      this.hidden = false;
    } else if (this.state === 'ambush') {
      this.moving = false;
      this.hidden = true;
      const distToHusky = Math.hypot(husky.x - this.x, husky.y - this.y);
      const seesHusky = this.canSee(husky, obstacles, perks, envMul) || distToHusky < 125;
      if (seesHusky) {
        this.state = 'chase';
        this.hidden = false;
        this.ambushLeapTimer = 1.2;
        if (typeof Audio !== 'undefined') Audio.play('lynx');
        this.lastSeen.x = husky.x;
        this.lastSeen.y = husky.y;
        this.alertTimer = this.alertMax;
      }
      return; // Ei jatketa muuhun päivitykseen
    } else {
      if (this.state === 'flee') this.state = 'patrol'; // pelästys ohi
      // Jos partioiva ilves vaeltaa pusikkoon, se voi mennä uudelleen väijyyn
      if ((this.kind === 'lynx' || this.kind === 'panther') && this.state === 'patrol') {
        for (const o of obstacles) {
          if (o.type === 'bush' && Math.hypot(this.x - o.x, this.y - o.y) < o.radius * 0.7) {
            this.state = 'ambush';
            this.x = o.x;
            this.y = o.y;
            this.hidden = true;
            this.moving = false;
            return;
          }
        }
      }

      if (this.canSee(husky, obstacles, perks, envMul)) {
        // Näkee huskyn → jahtaa ja painaa mieleen sijainnin
        if (this.state !== 'chase') {
          if (this.kind === 'eagle' && typeof Audio !== 'undefined') Audio.play('eagle');
          if (this.kind === 'owl' && typeof Audio !== 'undefined') Audio.play('lynx');
        }
        this.state = 'chase';
        this.lastSeen.x = husky.x;
        this.lastSeen.y = husky.y;
        this.alertTimer = this.alertMax;
      } else if (this.state === 'chase') {
        // Juuri menetti näköyhteyden → siirry tutkimaan viimeistä havaintoa
        this.state = 'alert';
      } else if (this.state === 'alert') {
        this.alertTimer -= dt;
        const reached = Math.hypot(this.lastSeen.x - this.x, this.lastSeen.y - this.y) < 10;
        if (this.alertTimer <= 0 || reached) this.state = 'patrol';
      }
    }

    if (this.state === 'flee') {
      // Pakene huskystä poispäin
      const dx = this.x - husky.x;
      const dy = this.y - husky.y;
      const dist = Math.hypot(dx, dy) || 1;
      this.facing = Math.atan2(dy, dx);
      this.x += (dx / dist) * this.chaseSpeed * speedScale * dt;
      this.y += (dy / dist) * this.chaseSpeed * speedScale * dt;
    } else if (this.state === 'chase') {
      if (this.ambushLeapTimer > 0) this.ambushLeapTimer -= dt;
      const dx = husky.x - this.x;
      const dy = husky.y - this.y;
      const dist = Math.hypot(dx, dy) || 1;
      this.facing = Math.atan2(dy, dx);
      const leapSpd = ((this.kind === 'lynx' || this.kind === 'panther') && this.ambushLeapTimer > 0) ? 1.45 : 1.0;
      this.x += (dx / dist) * this.chaseSpeed * leapSpd * speedScale * dt;
      this.y += (dy / dist) * this.chaseSpeed * leapSpd * speedScale * dt;
    } else if (this.state === 'alert') {
      // Liiku kohti viimeistä havaintopaikkaa (hieman jahtia hitaammin)
      const dx = this.lastSeen.x - this.x;
      const dy = this.lastSeen.y - this.y;
      const dist = Math.hypot(dx, dy) || 1;
      this.facing = Math.atan2(dy, dx);
      this.x += (dx / dist) * this.chaseSpeed * 0.7 * speedScale * dt;
      this.y += (dy / dist) * this.chaseSpeed * 0.7 * speedScale * dt;
    } else {
      // Partiointi: vaihda suuntaa satunnaisesti
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0) {
        this.facing += (Math.random() - 0.5) * Math.PI;
        this.wanderTimer = 1.5 + Math.random() * 2;
      }
      this.x += Math.cos(this.facing) * this.patrolSpeed * speedScale * dt;
      this.y += Math.sin(this.facing) * this.patrolSpeed * speedScale * dt;

      // Kimpoa reunoista
      if (this.x < this.radius || this.x > world.width - this.radius) {
        this.facing = Math.PI - this.facing;
      }
      if (this.y < this.radius || this.y > world.height - this.radius) {
        this.facing = -this.facing;
      }
    }
    this.resolveBounds(world, obstacles);

    // Kotkan lentokorkeuden päivitys
    if (this.kind === 'eagle') {
      if (this.state === 'chase') {
        const distToHusky = Math.hypot(husky.x - this.x, husky.y - this.y);
        if (distToHusky < 180) {
          this.heightOffset = Math.max(0, this.heightOffset - dt * 130); // syöksyy
        } else {
          this.heightOffset = Math.min(60, this.heightOffset + dt * 45); // nousee
        }
      } else {
        this.heightOffset = Math.min(60, this.heightOffset + dt * 45); // nousee
      }
    }

    // Animaatio + kääntyminen kulkusuunnan mukaan
    this.moving = true;
    this.flip = Math.cos(this.facing) < 0 ? -1 : 1;
    this.animPhase += dt * (this.state === 'patrol' ? 6 : 12);
  }

  // Pidä kentän sisällä ja työnnä ulos kivistä. Palauttaa true jos osui
  // seinään/kiveen (käytetään syöksyn keskeytykseen).
  resolveBounds(world, obstacles) {
    if (this.kind === 'eagle') {
      // Kotka lentää eikä törmää esteisiin, pysyy vain kentän sisällä
      const cx = clamp(this.x, this.radius, world.width - this.radius);
      const cy = clamp(this.y, this.radius, world.height - this.radius);
      this.x = cx;
      this.y = cy;
      return false;
    }

    let hit = false;
    const cx = clamp(this.x, this.radius, world.width - this.radius);
    const cy = clamp(this.y, this.radius, world.height - this.radius);
    if (cx !== this.x || cy !== this.y) hit = true;
    this.x = cx;
    this.y = cy;
    for (const o of obstacles) {
      if (!o.solid) continue;
      const dist = Math.hypot(this.x - o.x, this.y - o.y);
      if (dist < this.radius + o.radius && dist > 0) {
        const overlap = this.radius + o.radius - dist;
        this.x += ((this.x - o.x) / dist) * overlap;
        this.y += ((this.y - o.y) / dist) * overlap;
        hit = true;
      }
    }
    return hit;
  }

  drawVision(ctx) {
    // Pelästyneenä ei näkökenttää — peto vain pakenee
    if (this.state === 'flee') return;
    // Näkökenttä keilana: punainen = jahtaa, oranssi = etsii, keltainen = partioi
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.facing);
    const grd = ctx.createRadialGradient(0, 0, this.radius, 0, 0, this.viewDist);
    const color = this.state === 'chase' ? '255,80,60'
      : this.state === 'alert' ? '255,150,40'
      : '240,220,120';
    grd.addColorStop(0, `rgba(${color},0.28)`);
    grd.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, this.viewDist, -this.viewAngle, this.viewAngle);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  draw(ctx) {
    ctx.save();
    if (this.hidden) {
      ctx.globalAlpha = 0.15; // Ilves erittäin näkymätön pensaassa
    }
    Sprites.draw(ctx, this);

    // Piirretään huutomerkki ilveksen pään päälle heti loikan alussa
    if (this.kind === 'lynx' && this.ambushLeapTimer > 0) {
      ctx.globalAlpha = 1.0;
      ctx.fillStyle = '#ff3333';
      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('!', this.x, this.y - this.radius - 12);
    }
    ctx.restore();
  }
}

// --- Companion: pelaajaa seuraava ja saalistava koirakaveri ---
class Companion {
  constructor(x, y, skin = 'default') {
    this.x = x;
    this.y = y;
    this.radius = 16;   // hieman pelaajaa pienempi
    this.speed = 210;   // hieman pelaajaa hitaampi
    this.facing = 0;
    this.flip = 1;
    this.animPhase = 0;
    this.moving = false;
    this.kind = 'husky'; // Piirretään huskyn muotoisena
    this.skin = skin;
    this.state = 'follow'; // 'follow' tai 'hunt'
    this.targetPrey = null;
    this.vx = 0;
    this.vy = 0;
  }

  update(dt, player, preyList = [], world, obstacles = []) {
    // Etsitään lähin elossa oleva saalis
    let closestPrey = null;
    let minDist = 340; // saalistushavaintoalue 340 pikseliä
    for (const p of preyList) {
      if (!p.alive) continue;
      const dist = Math.hypot(this.x - p.x, this.y - p.y);
      if (dist < minDist) {
        minDist = dist;
        closestPrey = p;
      }
    }

    let targetX = player.x;
    let targetY = player.y;
    let speedFactor = 1.0;

    if (closestPrey) {
      this.state = 'hunt';
      this.targetPrey = closestPrey;
      targetX = closestPrey.x;
      targetY = closestPrey.y;
      speedFactor = 1.25; // kaveri juoksee kovempaa saalistaessaan
    } else {
      this.state = 'follow';
      this.targetPrey = null;
      // Seuraa pelaajaa, mutta jätä pieni turvaväli
      const distToPlayer = Math.hypot(this.x - player.x, this.y - player.y);
      if (distToPlayer < 75) {
        this.moving = false;
        // Jarrutetaan
        this.vx += (0 - this.vx) * 8 * dt;
        this.vy += (0 - this.vy) * 8 * dt;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.animPhase = 0;
        return;
      }
    }

    // Suunta kohteeseen
    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const d = Math.hypot(dx, dy) || 1;

    const spd = this.speed * speedFactor;

    // Liukkaan jään, mudan ja veden tunnistus kaverille
    let onIce = false;
    let inMud = false;
    let inWater = false;
    for (const o of obstacles) {
      const dist = Math.hypot(this.x - o.x, this.y - o.y);
      if (o.type === 'ice' && dist < o.radius) onIce = true;
      if (o.type === 'mud' && dist < o.radius) inMud = true;
      if (o.type === 'water' && dist < o.radius) inWater = true;
    }

    let finalSpd = spd;
    if (inMud) finalSpd *= 0.65;
    if (inWater) finalSpd *= 0.5;

    const targetVx = (dx / d) * finalSpd;
    const targetVy = (dy / d) * finalSpd;

    if (onIce) {
      const accel = 1.6;
      this.vx += (targetVx - this.vx) * accel * dt;
      this.vy += (targetVy - this.vy) * accel * dt;
    } else {
      this.vx = targetVx;
      this.vy = targetVy;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    const currentSpeed = Math.hypot(this.vx, this.vy);
    this.moving = currentSpeed > 15;

    if (this.moving) {
      this.facing = Math.atan2(this.vy, this.vx);
      this.flip = this.vx < 0 ? -1 : 1;
      this.animPhase += dt * 14;
    }

    // Pidä kaveri kentän rajoissa ja poissa esteistä
    this.resolveBounds(world, obstacles);
  }

  resolveBounds(world, obstacles) {
    const cx = clamp(this.x, this.radius, world.width - this.radius);
    const cy = clamp(this.y, this.radius, world.height - this.radius);
    this.x = cx;
    this.y = cy;
    for (const o of obstacles) {
      if (!o.solid) continue;
      const dist = Math.hypot(this.x - o.x, this.y - o.y);
      if (dist < this.radius + o.radius && dist > 0) {
        const overlap = this.radius + o.radius - dist;
        this.x += ((this.x - o.x) / dist) * overlap;
        this.y += ((this.y - o.y) / dist) * overlap;
      }
    }
  }

  draw(ctx) {
    Sprites.draw(ctx, this);
  }
}
