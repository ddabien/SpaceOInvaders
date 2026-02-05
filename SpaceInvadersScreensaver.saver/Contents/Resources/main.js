// Space Invaders – screensaver build (FIXED v2)
// - DEBUGGING INTENSO
// - Forzar inicialización del canvas

(() => {
  console.log('🎮 ===== SPACE INVADERS INICIANDO =====');
  console.log('📍 main.js cargado');
  
  const canvas = document.getElementById('c');
  if (!canvas) {
    console.error('❌ CRÍTICO: Canvas no encontrado!');
    document.body.innerHTML = '<div style="color:white;padding:20px;font-family:monospace;">ERROR: Canvas no encontrado</div>';
    return;
  }
  console.log('✅ Canvas encontrado:', canvas);
  
  const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  console.log('🎨 DPR:', DPR);
  
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) {
    console.error('❌ CRÍTICO: No se pudo obtener contexto 2d!');
    return;
  }
  console.log('✅ Contexto 2D obtenido');

  // ===== Audio =====
  const SOUND_ENABLED = true;
  let audio = null;

  function makeAudio() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    const ac = new AC();
    const master = ac.createGain();
    master.gain.value = 0.06;
    master.connect(ac.destination);

    function beep(freq = 440, dur = 0.08, type = 'square', vol = 0.6) {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.value = 0;
      o.connect(g); g.connect(master);
      const t = ac.currentTime;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.start(t); o.stop(t + dur + 0.02);
    }

    function noiseBurst(d = 0.12, v = 0.5) {
      const n = Math.floor(ac.sampleRate * d);
      const b = ac.createBuffer(1, n, ac.sampleRate);
      const a = b.getChannelData(0);
      for (let i = 0; i < n; i++) a[i] = (Math.random() * 2 - 1) * 0.7;
      const s = ac.createBufferSource(); s.buffer = b;
      const g = ac.createGain(); g.gain.value = 0;
      const t = ac.currentTime;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(v, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      s.connect(g); g.connect(master);
      s.start(t);
    }

    // UFO sound
    let ufoOsc = null, ufoGain = null, lfo = null, lfoGain = null;
    function ufoStart() {
      if (ufoOsc) return;
      ufoOsc = ac.createOscillator(); ufoGain = ac.createGain();
      ufoOsc.type = 'square'; ufoOsc.frequency.value = 560;
      ufoGain.gain.value = 0.0;
      ufoOsc.connect(ufoGain); ufoGain.connect(master);

      lfo = ac.createOscillator(); lfoGain = ac.createGain();
      lfo.frequency.value = 5.5; lfoGain.gain.value = 8;
      lfo.connect(lfoGain); lfoGain.connect(ufoOsc.frequency);

      const t = ac.currentTime;
      ufoGain.gain.linearRampToValueAtTime(0.07, t + 0.08);
      ufoOsc.start(); lfo.start();
    }

    function ufoStop() {
      if (!ufoOsc) return;
      const t = ac.currentTime;
      try {
        if (ufoGain) {
          ufoGain.gain.cancelScheduledValues(t);
          ufoGain.gain.setValueAtTime(ufoGain.gain.value, t);
          ufoGain.gain.linearRampToValueAtTime(0.0001, t + 0.08);
        }
        setTimeout(() => {
          try { ufoOsc.stop(); lfo && lfo.stop && lfo.stop(); } catch (e) {}
          try { ufoOsc.disconnect(); ufoGain && ufoGain.disconnect && ufoGain.disconnect(); } catch (e) {}
          try { lfo && lfo.disconnect && lfo.disconnect(); lfoGain && lfoGain.disconnect && lfoGain.disconnect(); } catch (e) {}
          ufoOsc = ufoGain = lfo = lfoGain = null;
        }, 120);
      } catch (e) {
        try { ufoOsc.stop(); } catch (_) {}
        ufoOsc = ufoGain = lfo = lfoGain = null;
      }
    }

    return {
      resume: () => ac.resume && ac.resume(),
      step: () => { const f = 360 + Math.random() * 60; beep(f, 0.07, 'square', 0.35); },
      shoot: () => { const f = 880 + Math.random() * 40; beep(f, 0.06, 'triangle', 0.45); },
      explosion: () => noiseBurst(0.12, 0.45),
      playerDie: () => { beep(220, 0.10, 'sawtooth', 0.5); setTimeout(() => beep(196, 0.12, 'sawtooth', 0.5), 120); },
      ufoStart, ufoStop
    };
  }

  // ===== Parámetros base (CSS px) =====
  const COLS = 11, ROWS = 5;
  const BASE_INVADER_SCALE = 0.38;
  const SHIP_SCALE = 0.44;

  const PLAYER_BULLET_W = 5, PLAYER_BULLET_H = 16;
  const ALIEN_BULLET_W = 5, ALIEN_BULLET_H = 14;

  const PLAYER_FIRE_COOLDOWN = 0.9, PLAYER_BULLET_SPEED = 340;
  const INVADER_STEP_SPEED = 26, INVADER_SPEED_MAX = 160, INVADER_ANIM_PERIOD = 0.35;

  const ALIEN_FIRE_COOLDOWN = 1.1, ALIEN_BULLET_SPEED = 160;
  const RESET_DELAY = 2.0;
  const PIXEL_SNAP = true;

  // Shields
  const SHIELD_SHAPE = [
    "    #########    ",
    "   ###########   ",
    "  #############  ",
    " ############### ",
    " ############### ",
    " ############### ",
    " ######   ###### ",
    " #####     ##### ",
    " ####       #### ",
    " ###         ### "
  ];
  const BLOCK = 7, SHIELD_COLOR = "#3dd13d";

  // UFO
  const UFO_BLOCK = 4, UFO_COLOR = "#ff00ff", UFO_SPEED = 140, UFO_Y = 70;
  const UFO_COOLDOWN_MIN = 10, UFO_COOLDOWN_MAX = 18;
  const UFO_SHAPE = [
    "    #########    ",
    "   ###########   ",
    "  #############  ",
    " ############### ",
    " ############### ",
    " ############### ",
    "   ###   ###     "
  ];

  // ===== Estado =====
  const images = {};
  const state = {
    w: 1024, h: 640,           // CSS px (se setea en resize)
    shipX: 512, shipY: 590,
    invaders: [], invDir: 1, invSpeed: INVADER_STEP_SPEED, animToggle: false, animElapsed: 0, edgeCooldown: 0,
    playerBullet: null, playerCooldown: 0,
    alienBullets: [], alienCooldown: 0,
    shields: [],
    ufo: null, ufoCooldown: (Math.random() * (UFO_COOLDOWN_MAX - UFO_COOLDOWN_MIN) + UFO_COOLDOWN_MIN),
    gameOver: false, youWin: false, resetTimer: 0,
    metrics: { invW: 24 * BASE_INVADER_SCALE, invH: 16 * BASE_INVADER_SCALE, shipW: 24 * SHIP_SCALE, shipH: 16 * SHIP_SCALE },
    layout: { gapX: 120, gapY: 72, startY: 120, stepDown: 20 },
    playerExplosion: { timer: 0 },
    playerDir: 1
  };

  function snap(v) { return PIXEL_SNAP ? Math.round(v) : v; }
  const rectsOverlap = (ax, ay, aw, ah, bx, by, bw, bh) =>
    ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;

  function computeMetrics() {
    const invW = (images.InvaderA ? images.InvaderA.naturalWidth : 24) * BASE_INVADER_SCALE;
    const invH = (images.InvaderA ? images.InvaderA.naturalHeight : 16) * BASE_INVADER_SCALE;
    const shipW = (images.Ship ? images.Ship.naturalWidth : 24) * SHIP_SCALE;
    const shipH = (images.Ship ? images.Ship.naturalHeight : 16) * SHIP_SCALE;

    state.metrics = { invW, invH, shipW, shipH };

    let gapX = invW * 1.7;
    let gapY = invH * 1.35;

    const targetTop = Math.max(100, state.h * 0.20);

    state.layout = {
      gapX, gapY,
      startY: targetTop,
      stepDown: Math.max(invH * 0.9, 12)
    };
  }

  function resize() {
    console.log('📐 Resize triggered');
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    console.log('  Window size:', w, 'x', h);

    // Canvas interno con DPR, pero coordenadas lógicas en CSS px
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    canvas.width = Math.floor(w * DPR);
    canvas.height = Math.floor(h * DPR);
    console.log('  Canvas interno:', canvas.width, 'x', canvas.height);

    // Normalizar para dibujar en CSS px
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    state.w = w;
    state.h = h;
    state.shipY = state.h - 50;

    computeMetrics();
    buildInvaders();
    buildShields();
    console.log('✅ Resize completado');
  }
  window.addEventListener('resize', resize);

  function buildInvaders() {
    const { gapX, gapY, startY } = state.layout;
    const total = (COLS - 1) * gapX;
    const startX = (state.w - total) / 2;

    state.invaders = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        state.invaders.push({ col: c, row: r, alive: true, x: startX + c * gapX, y: startY + r * gapY });
      }
    }
    state.invDir = 1;
    state.invSpeed = INVADER_STEP_SPEED;
    state.edgeCooldown = 0;
  }

  function buildShields() {
    const count = 4, margin = 120;
    const available = state.w - 2 * margin;
    const spacing = available / (count - 1);
    const baseY = state.h - 160;

    state.shields = [];
    for (let i = 0; i < count; i++) {
      const x = margin + i * spacing, cells = [];
      for (let r = 0; r < SHIELD_SHAPE.length; r++) {
        for (let c = 0; c < SHIELD_SHAPE[r].length; c++) {
          if (SHIELD_SHAPE[r][c] === '#') {
            cells.push({
              dx: (c - SHIELD_SHAPE[r].length / 2) * BLOCK,
              dy: (r - SHIELD_SHAPE.length / 2) * BLOCK,
              alive: true
            });
          }
        }
      }
      state.shields.push({ x, y: baseY, cells });
    }
  }

  function lowestAliveInColumn(col) {
    let res = null;
    for (const inv of state.invaders) {
      if (inv.col === col && inv.alive) {
        if (!res || inv.row > res.row) res = inv;
      }
    }
    return res;
  }

  function anyInvadersAlive() { return state.invaders.some(i => i.alive); }

  function ufoSize() {
    return { w: UFO_SHAPE[0].length * UFO_BLOCK, h: UFO_SHAPE.length * UFO_BLOCK };
  }

  function drawUFO() {
    const u = state.ufo;
    if (!u) return;
    const bw = UFO_BLOCK;
    const startX = snap(u.x - u.w / 2);
    const startY = snap(u.y - u.h / 2);
    ctx.fillStyle = UFO_COLOR;
    for (let r = 0; r < UFO_SHAPE.length; r++) {
      for (let c = 0; c < UFO_SHAPE[r].length; c++) {
        if (UFO_SHAPE[r][c] === '#') ctx.fillRect(startX + c * bw, startY + r * bw, bw, bw);
      }
    }
  }

  function update(dt) {
    if (state.gameOver) {
      state.resetTimer -= dt;
      if (state.resetTimer <= 0) resetGame();
      return;
    }

    // Ship auto
    state.shipX += 85 * dt * state.playerDir;
    if (state.shipX > state.w - 30) { state.shipX = state.w - 30; state.playerDir = -1; }
    if (state.shipX < 30) { state.shipX = 30; state.playerDir = 1; }

    // Player fire
    state.playerCooldown -= dt;
    if (!state.playerBullet && state.playerCooldown <= 0) {
      state.playerBullet = { x: state.shipX, y: state.shipY - 18, w: PLAYER_BULLET_W, h: PLAYER_BULLET_H, vy: -PLAYER_BULLET_SPEED };
      state.playerCooldown = PLAYER_FIRE_COOLDOWN * (0.8 + Math.random() * 0.4);
      if (SOUND_ENABLED && audio) audio.shoot();
    }
    if (state.playerBullet) {
      state.playerBullet.y += state.playerBullet.vy * dt;
      if (state.playerBullet.y + state.playerBullet.h < 0) state.playerBullet = null;
    }

    // Invaders move & animate
    state.animElapsed += dt;
    if (state.animElapsed > INVADER_ANIM_PERIOD) {
      state.animElapsed = 0;
      state.animToggle = !state.animToggle;
      if (SOUND_ENABLED && audio) audio.step();
    }
    for (const inv of state.invaders) {
      if (!inv.alive) continue;
      inv.x += state.invDir * state.invSpeed * dt;
    }

    // Edge & descent
    state.edgeCooldown -= dt;
    const margin = 20;
    const invW = state.metrics.invW, invH = state.metrics.invH;
    let minX = Infinity, maxX = -Infinity;

    for (const inv of state.invaders) {
      if (!inv.alive) continue;
      const L = inv.x - invW / 2, R = inv.x + invW / 2;
      if (L < minX) minX = L;
      if (R > maxX) maxX = R;
    }

    if (state.edgeCooldown <= 0 && (minX < margin || maxX > state.w - margin)) {
      state.invDir *= -1;
      for (const inv of state.invaders) if (inv.alive) inv.y += state.layout.stepDown;

      const shift = (minX < margin) ? (margin - minX) :
                    (maxX > state.w - margin) ? ((state.w - margin) - maxX) : 0;
      if (shift !== 0) for (const inv of state.invaders) inv.x += shift;

      state.invSpeed = Math.min(state.invSpeed * 1.06, INVADER_SPEED_MAX);
      state.edgeCooldown = 0.12;
    }

    // Alien fire
    state.alienCooldown -= dt;
    if (state.alienCooldown <= 0) {
      const cols = [...Array(COLS).keys()];
      while (cols.length) {
        const col = cols.splice(Math.floor(Math.random() * cols.length), 1)[0];
        const s = lowestAliveInColumn(col);
        if (s) {
          state.alienBullets.push({ x: s.x, y: s.y + 12, w: ALIEN_BULLET_W, h: ALIEN_BULLET_H, vy: ALIEN_BULLET_SPEED });
          break;
        }
      }
      state.alienCooldown = ALIEN_FIRE_COOLDOWN * (0.7 + Math.random() * 0.6);
    }

    for (const b of state.alienBullets) b.y += b.vy * dt;
    state.alienBullets = state.alienBullets.filter(b => b.y < state.h + 20);

    // Player bullet vs invaders
    if (state.playerBullet) {
      for (const inv of state.invaders) {
        if (!inv.alive) continue;
        const ix = inv.x - invW / 2, iy = inv.y - invH / 2;
        if (rectsOverlap(state.playerBullet.x, state.playerBullet.y, state.playerBullet.w, state.playerBullet.h, ix, iy, invW, invH)) {
          inv.alive = false;
          state.playerBullet = null;
          if (SOUND_ENABLED && audio) audio.explosion();
          break;
        }
      }
    }

    // Bullet vs shields
    function hitShield(b) {
      for (const sh of state.shields) {
        for (const c of sh.cells) {
          if (!c.alive) continue;
          const bx = sh.x + c.dx, by = sh.y + c.dy;
          if (rectsOverlap(b.x, b.y, b.w, b.h, bx, by, BLOCK, BLOCK)) {
            c.alive = false;
            return true;
          }
        }
      }
      return false;
    }
    if (state.playerBullet && hitShield(state.playerBullet)) state.playerBullet = null;
    state.alienBullets = state.alienBullets.filter(b => !hitShield(b));

    // Alien bullets vs ship
    const sx = state.shipX - state.metrics.shipW / 2;
    const sy = state.shipY - state.metrics.shipH / 2;
    for (const b of state.alienBullets) {
      if (rectsOverlap(b.x, b.y, b.w, b.h, sx, sy, state.metrics.shipW, state.metrics.shipH)) {
        state.playerExplosion = { timer: 0.7 };
        state.gameOver = true; state.youWin = false; state.resetTimer = RESET_DELAY;
        if (SOUND_ENABLED && audio) audio.playerDie();
        break;
      }
    }
    if (state.playerExplosion.timer > 0) state.playerExplosion.timer -= dt;

    // Win
    if (!anyInvadersAlive()) {
      state.gameOver = true; state.youWin = true; state.resetTimer = RESET_DELAY;
    }

    // UFO
    if (!state.ufo) {
      state.ufoCooldown -= dt;
      if (state.ufoCooldown <= 0) {
        const s = ufoSize();
        const dir = Math.random() < 0.5 ? 1 : -1;
        const x = dir > 0 ? -s.w - 16 : state.w + s.w + 16;
        state.ufo = { x, y: UFO_Y, w: s.w, h: s.h, dir };
        if (SOUND_ENABLED && audio) audio.ufoStart();
      }
    } else {
      state.ufo.x += state.ufo.dir * UFO_SPEED * dt;

      if (state.playerBullet) {
        const ux = state.ufo.x - state.ufo.w / 2;
        const uy = state.ufo.y - state.ufo.h / 2;
        if (rectsOverlap(state.playerBullet.x, state.playerBullet.y, state.playerBullet.w, state.playerBullet.h, ux, uy, state.ufo.w, state.ufo.h)) {
          state.playerBullet = null;
          state.ufo = null;
          state.ufoCooldown = 10 + Math.random() * 8;
          if (SOUND_ENABLED && audio) { audio.explosion(); audio.ufoStop(); }
        }
      }

      if (state.ufo && (
        (state.ufo.dir > 0 && state.ufo.x - state.ufo.w / 2 > state.w + 8) ||
        (state.ufo.dir < 0 && state.ufo.x + state.ufo.w / 2 < -8)
      )) {
        state.ufo = null;
        state.ufoCooldown = 10 + Math.random() * 8;
        if (SOUND_ENABLED && audio) audio.ufoStop();
      }
    }

    if (!state.ufo && SOUND_ENABLED && audio) audio.ufoStop();
  }

  function render() {
    // Fondo
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, state.w, state.h);

    // Shields
    ctx.fillStyle = SHIELD_COLOR;
    for (const sh of state.shields) {
      for (const c of sh.cells) {
        if (!c.alive) continue;
        ctx.fillRect(snap(sh.x + c.dx), snap(sh.y + c.dy), BLOCK, BLOCK);
      }
    }

    // UFO
    drawUFO();

    // Invaders
    const tex = state.animToggle ? images.InvaderB : images.InvaderA;
    const invW = state.metrics.invW, invH = state.metrics.invH;
    for (const inv of state.invaders) {
      if (!inv.alive) continue;
      ctx.drawImage(tex, snap(inv.x - invW / 2), snap(inv.y - invH / 2), invW, invH);
    }

    // Player o explosión
    const sw = state.metrics.shipW, sh = state.metrics.shipH;
    if (state.playerExplosion.timer > 0 && images.Explosion) {
      const scale = 1.2, ew = sw * scale, eh = sh * scale;
      ctx.drawImage(images.Explosion, snap(state.shipX - ew / 2), snap(state.shipY - eh / 2), ew, eh);
    } else {
      ctx.drawImage(images.Ship, snap(state.shipX - sw / 2), snap(state.shipY - sh / 2), sw, sh);
    }

    // Bullets
    ctx.fillStyle = "#fff";
    if (state.playerBullet) ctx.fillRect(snap(state.playerBullet.x), snap(state.playerBullet.y), state.playerBullet.w, state.playerBullet.h);
    for (const b of state.alienBullets) ctx.fillRect(snap(b.x), snap(b.y), b.w, b.h);

    // Scanlines
    ctx.fillStyle = "rgba(0,0,0,0.06)";
    for (let y = 0; y < state.h; y += 4) ctx.fillRect(0, y, state.w, 1);

    // Crédito discreto
    ctx.fillStyle = "rgba(61,209,61,0.35)";
    ctx.font = "8px 'Courier New', monospace";
    ctx.fillText("dr pendejoloco", 10, state.h - 8);
  }

  function resetGame() {
    state.gameOver = false; state.youWin = false;
    state.playerBullet = null; state.alienBullets = [];
    state.playerCooldown = 0; state.alienCooldown = 0.5;
    state.shipX = state.w / 2; state.playerDir = Math.random() > 0.5 ? 1 : -1;
    state.ufo = null;
    state.ufoCooldown = (Math.random() * (UFO_COOLDOWN_MAX - UFO_COOLDOWN_MIN) + UFO_COOLDOWN_MIN);
    state.playerExplosion = { timer: 0 };
    buildInvaders(); buildShields();
  }

  function loop(ts) {
    if (!loop.prev) loop.prev = ts;
    const dt = Math.min(0.05, (ts - loop.prev) / 1000);
    loop.prev = ts;
    update(dt);
    render();
    requestAnimationFrame(loop);
  }

  function loadImage(name) {
    return new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("No cargó: assets/" + name));
      i.src = "assets/" + name;
    });
  }

  Promise.allSettled([
    loadImage("Ship.gif").then(i => images.Ship = i),
    loadImage("InvaderA.gif").then(i => images.InvaderA = i),
    loadImage("InvaderB.gif").then(i => images.InvaderB = i),
    loadImage("GameOver.gif").then(i => images.GameOver = i),
    loadImage("Explosion.gif").then(i => images.Explosion = i)
  ]).then((results) => {
    console.log('🖼️  Resultados de carga de imágenes:', results.map(r => r.status));
    const failed = results.filter(r => r.status === "rejected").map(r => String(r.reason));
    if (failed.length) console.warn("⚠️  Sprites que no cargaron:", failed);

    if (!images.Ship || !images.InvaderA || !images.InvaderB) {
      console.error('❌ CRÍTICO: Faltan sprites esenciales');
      resize();
      ctx.fillStyle = "#fff";
      ctx.font = "18px monospace";
      ctx.fillText("ERROR: Faltan sprites en assets/", 30, 60);
      return;
    }

    console.log('✅ Sprites cargados OK');

    try {
      if (SOUND_ENABLED) {
        audio = makeAudio();
        audio && audio.resume && audio.resume();
        console.log('🔊 Audio inicializado');
      }
    } catch (e) {
      console.warn('⚠️  Audio falló:', e);
    }

    // Plan B para audio: cuando vuelve a estar visible
    document.addEventListener("visibilitychange", () => {
      try { audio && audio.resume && audio.resume(); } catch (e) {}
    });

    console.log('🚀 Iniciando juego...');
    resize();
    resetGame();
    requestAnimationFrame(loop);
    console.log('✅ Loop iniciado');
  });

})();
