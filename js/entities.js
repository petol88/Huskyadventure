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
    this.type = type; // 'bush' = piiloutumispaikka, 'rock' = kiinteä seinä
  }

  get solid() {
    return this.type === 'rock';
  }

  // Katkaiseeko tämä este näköyhteyden? Kivet kyllä, pusikot kyllä
  // (pusikon läpi ei näe — siksi sen taakse/sisään voi piiloutua).
  get blocksSight() {
    return true;
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
    } else {
      // Pusikko: pehmeä läiskä + biomin tunnusmerkki
      ctx.fillStyle = pal.bushFill || '#2e7d32';
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = `${this.radius * 1.4}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pal.bushEmoji || '🌳', this.x, this.y);
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
  }

  update(dt, dir, world, obstacles = [], perks = {}, sprintHeld = false) {
    if (this.howlCd > 0) this.howlCd -= dt;
    // Muinaisen kilven latautuminen
    if (perks.hasShield && !this.shieldReady) {
      this.shieldCd -= dt;
      if (this.shieldCd <= 0) this.shieldReady = true;
    }
    this.moving = dir.x !== 0 || dir.y !== 0;

    // Nopeus: peruskerroin + pensasmestari + sprintti
    let spd = this.speed * (perks.speedMul || 1);
    if (perks.bushSpeed && this.hidden) spd *= 1.3;

    this.sprinting = false;
    if (perks.hasSprint) {
      if (sprintHeld && this.moving && this.stamina > 0.02) {
        this.sprinting = true;
        spd *= 1.8;
        this.stamina = Math.max(0, this.stamina - dt * 0.7); // tyhjenee ~1.4 s
      } else {
        this.stamina = Math.min(1, this.stamina + dt * 0.35); // täyttyy ~2.8 s
      }
    }

    if (this.moving) {
      this.x += dir.x * spd * dt;
      this.y += dir.y * spd * dt;
      this.facing = Math.atan2(dir.y, dir.x);
      if (dir.x !== 0) this.flip = dir.x < 0 ? -1 : 1;
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
      // Pusikon sisällä = piilossa
      if (o.type === 'bush' && dist < o.radius) {
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
    this.radius = 13;
    this.kind = kind;
    // Lajikohtaiset ominaisuudet tuovat vaihtelua: jänis nopea, siili hidas
    const stats = {
      rabbit:   { speed: 155, fleeDist: 150 },
      mouse:    { speed: 112, fleeDist: 118 },
      squirrel: { speed: 145, fleeDist: 140 },
      hedgehog: { speed: 92,  fleeDist: 100 },
      bird:     { speed: 172, fleeDist: 165 },
    };
    const s = stats[kind] || stats.rabbit;
    this.speed = s.speed;
    this.fleeDist = s.fleeDist; // etäisyys jolla alkaa paeta
    this.alive = true;
    this.erratic = kind === 'bird'; // lintu pakenee mutkitellen
    this.zigTimer = 0;
    this.zigSign = 1;
    this.flip = 1;
    this.animPhase = 0;
    this.moving = false;
  }

  update(dt, husky, world, perks = {}) {
    const dx = this.x - husky.x;
    const dy = this.y - husky.y;
    const dist = Math.hypot(dx, dy);
    const fleeDist = this.fleeDist * (perks.preyFleeMul || 1);

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
      this.x += (vx / vlen) * this.speed * dt;
      this.y += (vy / vlen) * this.speed * dt;
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
    // Lajikohtaiset ominaisuudet: karhu hidas/leveä, susi ketterä, kettu nopea/kapea
    const stats = {
      bear: { radius: 26, patrol: 70, chase: 195, view: 215, angle: Math.PI / 3 },
      wolf: { radius: 26, patrol: 76, chase: 211, view: 230, angle: Math.PI / 3 },
      fox:  { radius: 20, patrol: 90, chase: 224, view: 265, angle: Math.PI / 4.5 },
    };
    const s = stats[kind] || stats.bear;
    // Pomo on isompi, hieman nopeampi ja näkee laajemmalti
    const bossSpd = isBoss ? 1.06 : 1;
    this.radius = s.radius * (isBoss ? 1.5 : 1);
    this.patrolSpeed = s.patrol * speedMul * bossSpd;
    this.chaseSpeed = s.chase * speedMul * bossSpd;
    this.viewDist = s.view * (isBoss ? 1.3 : 1);
    this.viewAngle = isBoss ? Math.PI / 2.5 : s.angle;
    this.flip = 1;
    this.animPhase = 0;
    this.moving = false;
    this.facing = Math.random() * Math.PI * 2;
    this.state = 'patrol';        // 'patrol', 'chase', 'alert' tai 'flee'
    this.wanderTimer = 0;
    this.scareTimer = 0;          // pelästyksen kesto (s jäljellä, huskyn ulvonnasta)
    this.alertTimer = 0;          // kuinka kauan tutkii viimeistä havaintoa
    this.alertMax = 2.6;
    this.lastSeen = { x, y };     // viimeisin huskyn havaintopaikka
    // Pomon syöksyhyökkäys
    this.chargeState = 'none';    // 'none' | 'windup' | 'lunge' | 'recover'
    this.chargeTimer = 0;
    this.chargeCd = 2.5;          // alkujäähdytys ennen ensimmäistä syöksyä
    this.chargeDir = { x: 1, y: 0 };
  }

  // Pelästytä peto: pakenee huskystä annetun ajan.
  // Pomo on vastustuskykyinen (pelästyy vain lyhyesti).
  scare(duration) {
    this.scareTimer = Math.max(this.scareTimer, this.isBoss ? duration * 0.4 : duration);
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
      const spd = this.chaseSpeed * 2.6;
      this.x += this.chargeDir.x * spd * dt;
      this.y += this.chargeDir.y * spd * dt;
      this.moving = true;
      this.animPhase += dt * 22;
      this.flip = this.chargeDir.x < 0 ? -1 : 1;
      const hit = this.resolveBounds(world, obstacles);
      // Osuma seinään/kiveen → tyrmääntyy (pidempi toipuminen = pakohetki)
      if (hit || this.chargeTimer <= 0) {
        this.chargeState = 'recover';
        this.chargeTimer = hit ? 1.4 : 0.9;
        this.chargeCd = hit ? 4.5 : 3.5;
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

    // Näköyhteys katkeaa jos este on pedon ja huskyn välissä
    for (const o of obstacles) {
      if (o.blocksSight && segmentHitsCircle(this.x, this.y, husky.x, husky.y, o.x, o.y, o.radius)) {
        return false;
      }
    }
    return true;
  }

  update(dt, husky, world, obstacles = [], perks = {}, envMul = 1) {
    // Pomon syöksyhyökkäys ohittaa tavallisen tekoälyn kun aktiivinen
    if (this.isBoss && this.updateCharge(dt, husky, world, obstacles, perks, envMul)) return;

    // Tilakoneen päätös
    if (this.scareTimer > 0) {
      // Pelästys (ulvonta) ohittaa muun tekoälyn
      this.scareTimer -= dt;
      this.state = 'flee';
    } else {
      if (this.state === 'flee') this.state = 'patrol'; // pelästys ohi
      if (this.canSee(husky, obstacles, perks, envMul)) {
        // Näkee huskyn → jahtaa ja painaa mieleen sijainnin
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
      this.x += (dx / dist) * this.chaseSpeed * dt;
      this.y += (dy / dist) * this.chaseSpeed * dt;
    } else if (this.state === 'chase') {
      const dx = husky.x - this.x;
      const dy = husky.y - this.y;
      const dist = Math.hypot(dx, dy) || 1;
      this.facing = Math.atan2(dy, dx);
      this.x += (dx / dist) * this.chaseSpeed * dt;
      this.y += (dy / dist) * this.chaseSpeed * dt;
    } else if (this.state === 'alert') {
      // Liiku kohti viimeistä havaintopaikkaa (hieman jahtia hitaammin)
      const dx = this.lastSeen.x - this.x;
      const dy = this.lastSeen.y - this.y;
      const dist = Math.hypot(dx, dy) || 1;
      this.facing = Math.atan2(dy, dx);
      this.x += (dx / dist) * this.chaseSpeed * 0.7 * dt;
      this.y += (dy / dist) * this.chaseSpeed * 0.7 * dt;
    } else {
      // Partiointi: vaihda suuntaa satunnaisesti
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0) {
        this.facing += (Math.random() - 0.5) * Math.PI;
        this.wanderTimer = 1.5 + Math.random() * 2;
      }
      this.x += Math.cos(this.facing) * this.patrolSpeed * dt;
      this.y += Math.sin(this.facing) * this.patrolSpeed * dt;

      // Kimpoa reunoista
      if (this.x < this.radius || this.x > world.width - this.radius) {
        this.facing = Math.PI - this.facing;
      }
      if (this.y < this.radius || this.y > world.height - this.radius) {
        this.facing = -this.facing;
      }
    }
    this.resolveBounds(world, obstacles);

    // Animaatio + kääntyminen kulkusuunnan mukaan
    this.moving = true;
    this.flip = Math.cos(this.facing) < 0 ? -1 : 1;
    this.animPhase += dt * (this.state === 'patrol' ? 6 : 12);
  }

  // Pidä kentän sisällä ja työnnä ulos kivistä. Palauttaa true jos osui
  // seinään/kiveen (käytetään syöksyn keskeytykseen).
  resolveBounds(world, obstacles) {
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
    Sprites.draw(ctx, this);
  }
}
