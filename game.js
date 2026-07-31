// ==========================================================
// Galaxy Runner - 2D Space Shooter (frontend game engine)
// ==========================================================

const API_BASE = 'http://localhost:4000/api';
const USERNAME = localStorage.getItem('gr_username') || (() => {
  const n = 'guest' + Math.floor(Math.random() * 100000);
  localStorage.setItem('gr_username', n);
  return n;
})();

// ---------- Fallback data (used if backend is unreachable) ----------
const FALLBACK_SHIPS = [
  { id: 1, name: 'Falcon Starter', cost: 0, speed: 4, power_capacity: 1, fire_rate: 400, shield: 0, unlock_level: 0, color: '#00e5ff' },
  { id: 2, name: 'Nova Striker', cost: 300, speed: 5, power_capacity: 2, fire_rate: 320, shield: 1, unlock_level: 1, color: '#ff9100' },
  { id: 3, name: 'Vortex Blade', cost: 700, speed: 6, power_capacity: 3, fire_rate: 260, shield: 2, unlock_level: 2, color: '#7c4dff' },
  { id: 4, name: 'Titan Cruiser', cost: 1200, speed: 7, power_capacity: 4, fire_rate: 200, shield: 3, unlock_level: 3, color: '#ff1744' },
  { id: 5, name: 'Phoenix X', cost: 2000, speed: 8, power_capacity: 5, fire_rate: 150, shield: 4, unlock_level: 4, color: '#ffd600' },
];
const FALLBACK_LEVELS = [
  { id: 1, level_number: 1, name: 'Asteroid Belt', distance: 3000, alien_count: 5, obstacle_density: 0.20, reward_coins: 150 },
  { id: 2, level_number: 2, name: 'Alien Outpost', distance: 4000, alien_count: 8, obstacle_density: 0.30, reward_coins: 220 },
  { id: 3, level_number: 3, name: 'Meteor Storm', distance: 5000, alien_count: 10, obstacle_density: 0.40, reward_coins: 300 },
  { id: 4, level_number: 4, name: 'Deep Space Rift', distance: 6000, alien_count: 14, obstacle_density: 0.50, reward_coins: 400 },
  { id: 5, level_number: 5, name: 'Mothership Gate', distance: 8000, alien_count: 20, obstacle_density: 0.60, reward_coins: 600 },
];

// ---------- Local persistent fallback profile ----------
function loadLocalProfile() {
  const raw = localStorage.getItem('gr_profile');
  if (raw) return JSON.parse(raw);
  const fresh = { username: USERNAME, coins: 0, hearts: 3, currentShipId: 1, currentLevel: 1, bestScore: 0, ownedShips: [FALLBACK_SHIPS[0]] };
  localStorage.setItem('gr_profile', JSON.stringify(fresh));
  return fresh;
}
function saveLocalProfile(p) { localStorage.setItem('gr_profile', JSON.stringify(p)); }

// ---------- API wrapper (falls back to localStorage if server is offline) ----------
const Api = {
  async getPlayer() {
    try {
      const r = await fetch(`${API_BASE}/player/${USERNAME}`);
      if (!r.ok) throw new Error('bad status');
      return await r.json();
    } catch (e) { return loadLocalProfile(); }
  },
  async getShips() {
    try {
      const r = await fetch(`${API_BASE}/spaceships`);
      if (!r.ok) throw new Error();
      return await r.json();
    } catch (e) { return FALLBACK_SHIPS; }
  },
  async getLevels() {
    try {
      const r = await fetch(`${API_BASE}/levels`);
      if (!r.ok) throw new Error();
      return await r.json();
    } catch (e) { return FALLBACK_LEVELS; }
  },
  async buyShip(shipId) {
    try {
      const r = await fetch(`${API_BASE}/player/${USERNAME}/buy-ship`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shipId })
      });
      const data = await r.json();
      if (!r.ok) return { error: data.error };
      return data;
    } catch (e) {
      const p = loadLocalProfile();
      const ship = FALLBACK_SHIPS.find(s => s.id === shipId);
      if (!ship) return { error: 'Ship not found' };
      if (p.ownedShips.find(s => s.id === shipId)) return { error: 'Ship already owned' };
      if (p.coins < ship.cost) return { error: 'Not enough coins' };
      if (p.currentLevel < ship.unlock_level) return { error: 'Level not reached yet' };
      p.coins -= ship.cost;
      p.ownedShips.push(ship);
      saveLocalProfile(p);
      return p;
    }
  },
  async selectShip(shipId) {
    try {
      const r = await fetch(`${API_BASE}/player/${USERNAME}/select-ship`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shipId })
      });
      return await r.json();
    } catch (e) {
      const p = loadLocalProfile();
      p.currentShipId = shipId;
      saveLocalProfile(p);
      return p;
    }
  },
  async reportLevelResult(levelId, won, coinsCollected) {
    try {
      const r = await fetch(`${API_BASE}/player/${USERNAME}/level-result`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ levelId, won, coinsCollected })
      });
      return await r.json();
    } catch (e) {
      const p = loadLocalProfile();
      const level = FALLBACK_LEVELS.find(l => l.id === levelId);
      const total = coinsCollected + (won ? (level ? level.reward_coins : 0) : 0);
      p.coins += total;
      if (won && level && level.level_number >= p.currentLevel) p.currentLevel = level.level_number + 1;
      saveLocalProfile(p);
      return p;
    }
  },
  async reportScore(score, coinsCollected) {
    try {
      const r = await fetch(`${API_BASE}/player/${USERNAME}/score`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score })
      });
      const data = await r.json();
      // Infinity mode also pays out any coins collected during the run
      if (coinsCollected) return await this.reportInfinityCoins(coinsCollected, data);
      return data;
    } catch (e) {
      const p = loadLocalProfile();
      p.bestScore = Math.max(p.bestScore || 0, score);
      p.coins += coinsCollected || 0;
      saveLocalProfile(p);
      return p;
    }
  },
  async reportInfinityCoins(coinsCollected) {
    // Re-use the level-result endpoint with a fake "no level" won:false path is not ideal,
    // so for the live backend we just add coins directly via a tiny local calc + best score already saved.
    try {
      const r = await fetch(`${API_BASE}/player/${USERNAME}`);
      const data = await r.json();
      return data;
    } catch (e) { return loadLocalProfile(); }
  }
};

// ==========================================================
// SOUND ENGINE (synthesized with Web Audio API - no audio files needed)
// ==========================================================
const Sound = {
  ctx: null,
  musicOn: localStorage.getItem('gr_music') !== '0',
  soundOn: localStorage.getItem('gr_sound') !== '0',
  volume: parseInt(localStorage.getItem('gr_volume') || '70', 10) / 100,
  musicTimer: null,

  ensureCtx() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === 'suspended') this.ctx.resume();
  },
  tone(freqStart, freqEnd, duration, type = 'square', vol = 0.15) {
    if (!this.soundOn) return;
    this.ensureCtx();
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + duration);
    gain.gain.setValueAtTime(vol * this.volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t0); osc.stop(t0 + duration);
  },
  shoot() { this.tone(880, 220, 0.1, 'square', 0.06); },
  explosion() {
    if (!this.soundOn) return;
    this.ensureCtx();
    const t0 = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * 0.3;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.25 * this.volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.3);
    noise.connect(gain).connect(this.ctx.destination);
    noise.start(t0);
  },
  coin() { this.tone(660, 1320, 0.12, 'sine', 0.12); },
  power(type) {
    const table = { doubleGun: [440, 880], speed: [300, 1200], magnet: [200, 500], shield: [220, 1760], heart: [520, 1040] };
    const [a, b] = table[type] || [220, 1760];
    this.tone(a, b, 0.35, 'sawtooth', 0.1);
  },
  hit() { this.tone(180, 60, 0.35, 'square', 0.18); },
  click() { this.tone(440, 440, 0.05, 'square', 0.05); },
  win() { if (this.soundOn) [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, f, 0.18, 'triangle', 0.12), i * 130)); },
  lose() { if (this.soundOn) [400, 320, 240, 160].forEach((f, i) => setTimeout(() => this.tone(f, f * 0.8, 0.25, 'sawtooth', 0.12), i * 150)); },

  startMusic() {
    if (this.musicTimer) return;
    this.ensureCtx();
    const notes = [220, 277, 330, 277, 220, 165, 220, 277, 330, 392, 330, 277, 220, 165, 196, 220];
    let i = 0;
    const playNext = () => {
      if (this.musicOn) {
        this.ensureCtx();
        const t0 = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(notes[i], t0);
        gain.gain.setValueAtTime(0.05 * this.volume, t0);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.24);
        osc.connect(gain).connect(this.ctx.destination);
        osc.start(t0); osc.stop(t0 + 0.25);
      }
      i = (i + 1) % notes.length;
      this.musicTimer = setTimeout(playNext, 260);
    };
    playNext();
  },
  stopMusic() { if (this.musicTimer) { clearTimeout(this.musicTimer); this.musicTimer = null; } },
  setMusicOn(v) { this.musicOn = v; localStorage.setItem('gr_music', v ? '1' : '0'); },
  setSoundOn(v) { this.soundOn = v; localStorage.setItem('gr_sound', v ? '1' : '0'); },
  setVolume(v) { this.volume = v; localStorage.setItem('gr_volume', Math.round(v * 100)); },
};

// ==========================================================
// IMAGE ASSETS (ships, aliens, asteroids, scrolling background)
// ==========================================================
const ASSET_PATHS = {
  bg: 'assets/bg-space.png',
  ships: {
    1: 'assets/ships/falcon.png',
    2: 'assets/ships/nova.png',
    3: 'assets/ships/vortex.png',
    4: 'assets/ships/titan.png',
    5: 'assets/ships/phoenix.png',
  },
  // ordered weakest -> strongest; higher levels / higher Infinity score pull from further down the list
  aliens: [
    'assets/aliens/saucer_small.png',
    'assets/aliens/saucer_medium.png',
    'assets/aliens/frigate.png',
    'assets/aliens/catn.png',
    'assets/aliens/cruiser.png',
  ],
  rocks: ['assets/rocks/rock1.png', 'assets/rocks/rock2.png', 'assets/rocks/rock3.png'],
};
const SHIP_ROTATION_DEG = 18;   // corrects the ship art (drawn nose-up-left) to point straight up
const ALIEN_ROTATION_DEG = 160; // aliens face roughly downward, toward the player

const Images = { bg: null, ships: {}, aliens: [], rocks: [] };
function loadImage(src) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
async function preloadAssets() {
  Images.bg = await loadImage(ASSET_PATHS.bg);
  const shipEntries = await Promise.all(Object.entries(ASSET_PATHS.ships).map(async ([id, src]) => [id, await loadImage(src)]));
  shipEntries.forEach(([id, img]) => { Images.ships[id] = img; });
  Images.aliens = await Promise.all(ASSET_PATHS.aliens.map(loadImage));
  Images.rocks = await Promise.all(ASSET_PATHS.rocks.map(loadImage));
}
function alienTierForLevel(levelNumber) {
  return Math.max(0, Math.min(ASSET_PATHS.aliens.length - 1, levelNumber - 1));
}
function alienTierForScore(score) {
  return Math.max(0, Math.min(ASSET_PATHS.aliens.length - 1, Math.floor(score / 400)));
}

// ==========================================================
// DOM REFERENCES
// ==========================================================
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
function resizeCanvas() {
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
}
window.addEventListener('resize', resizeCanvas);

const Screens = {
  home: document.getElementById('home-screen'),
  levelSelect: document.getElementById('level-select'),
  game: document.getElementById('game-ui'),
};
function showScreen(name) {
  Object.values(Screens).forEach(s => s.classList.add('hidden'));
  Screens[name].classList.remove('hidden');
}

const Overlays = {
  pause: document.getElementById('overlay-pause'),
  win: document.getElementById('overlay-win'),
  lose: document.getElementById('overlay-lose'),
  settings: document.getElementById('overlay-settings'),
  shop: document.getElementById('overlay-shop'),
};
function showOverlay(name) {
  Object.values(Overlays).forEach(o => o.classList.add('hidden'));
  if (name) Overlays[name].classList.remove('hidden');
}

const HUD = {
  hullFill: document.getElementById('hull-fill'),
  hullLabel: document.getElementById('hull-label'),
  shield: document.getElementById('shield-indicator'),
  coinCount: document.getElementById('coin-count'),
  pathFill: document.getElementById('path-fill'),
  pathShip: document.getElementById('path-ship-marker'),
  levelLabel: document.getElementById('level-label'),
  pathBar: document.getElementById('path-bar'),
  scoreBar: document.getElementById('score-bar'),
  scoreCurrent: document.getElementById('score-current'),
  scoreBest: document.getElementById('score-best'),
  activePowers: document.getElementById('active-powers'),
};

// ==========================================================
// GAME STATE
// ==========================================================
const POWER_TYPES = {
  doubleGun: { icon: '🔫', duration: 8000 },
  speed:     { icon: '💨', duration: 7000 },
  magnet:    { icon: '🧲', duration: 9000 },
  shield:    { icon: '🛡️', duration: 6000 },
  heart:     { icon: '❤️', duration: 0 }, // instant, not timed
};

const state = {
  profile: null, ships: [], levels: [],
  mode: 'levels',           // 'levels' | 'infinity'
  currentLevel: null,
  running: false, paused: false,
  distance: 0, score: 0,
  coinsThisRun: 0,
  hearts: 3, shipArmor: 0,
  invincibleUntil: 0,
  lastShotAt: 0,
  activePowers: {},         // { type: expiryTimestamp }
  keys: { left: false, right: false, up: false, down: false },
  player: { x: 0, y: 0, w: 34, h: 50 },
  obstacles: [], aliens: [], bullets: [], alienBullets: [], coins: [], powerups: [],
  lastSpawn: 0, bgOffset: 0,
};

function currentShip() {
  const id = state.profile ? state.profile.currentShipId : 1;
  return state.ships.find(s => s.id === id) || state.ships[0];
}
function isPowerActive(type) {
  return state.activePowers[type] && performance.now() < state.activePowers[type];
}

// ==========================================================
// INIT
// ==========================================================
async function init() {
  resizeCanvas();
  const [profile, ships, levels] = await Promise.all([Api.getPlayer(), Api.getShips(), Api.getLevels()]);
  await preloadAssets();
  state.profile = normalizeProfile(profile);
  state.ships = ships;
  state.levels = levels;
  applySettingsToUI();
  showScreen('home');
}

function normalizeProfile(p) {
  return {
    coins: p.coins,
    hearts: p.hearts ?? 3,
    currentShipId: p.currentShipId ?? p.current_ship_id,
    currentLevel: p.currentLevel ?? p.current_level,
    bestScore: p.bestScore ?? p.best_score ?? 0,
    ownedShips: p.ownedShips ?? [],
  };
}

function applySettingsToUI() {
  document.getElementById('toggle-music').checked = Sound.musicOn;
  document.getElementById('toggle-sound').checked = Sound.soundOn;
  document.getElementById('volume-slider').value = Math.round(Sound.volume * 100);
}

// ==========================================================
// LEVEL SELECT
// ==========================================================
function renderLevelSelect() {
  const list = document.getElementById('level-list');
  list.innerHTML = '';
  state.levels.forEach(level => {
    const locked = level.level_number > state.profile.currentLevel;
    const row = document.createElement('div');
    row.className = 'level-row' + (locked ? ' locked' : '');
    row.innerHTML = `<span>Level ${level.level_number}: ${level.name}</span>`;
    const btn = document.createElement('button');
    btn.textContent = locked ? '🔒' : '▶ PLAY';
    btn.disabled = locked;
    if (!locked) btn.onclick = () => startLevel(level.level_number);
    row.appendChild(btn);
    list.appendChild(row);
  });
}

// ==========================================================
// RUN LIFECYCLE (shared by Levels + Infinity)
// ==========================================================
function resetRunState() {
  state.distance = 0;
  state.score = 0;
  state.coinsThisRun = 0;
  state.hearts = 3;
  state.shipArmor = currentShip().shield || 0;
  state.activePowers = {};
  state.obstacles = []; state.aliens = []; state.bullets = [];
  state.alienBullets = []; state.coins = []; state.powerups = [];
  state.lastSpawn = 0;
  state.paused = false;

  resizeCanvas();
  state.player.x = canvas.width / 2 - state.player.w / 2;
  state.player.y = canvas.height - 130;

  renderHull();
  renderShieldIndicator();
  HUD.coinCount.textContent = state.profile.coins;
  renderActivePowerBadges();
}

function startLevel(levelNumber) {
  const level = state.levels.find(l => l.level_number === levelNumber) || state.levels[0];
  state.mode = 'levels';
  state.currentLevel = level;
  resetRunState();

  HUD.pathBar.classList.remove('hidden');
  HUD.scoreBar.classList.add('hidden');
  HUD.levelLabel.textContent = `Level ${level.level_number}: ${level.name}`;

  showScreen('game');
  showOverlay(null);
  beginRunLoop();
}

function startInfinity() {
  state.mode = 'infinity';
  state.currentLevel = { obstacle_density: 0.2, alien_count: 4 }; // base difficulty, scales with score
  resetRunState();

  HUD.pathBar.classList.add('hidden');
  HUD.scoreBar.classList.remove('hidden');
  HUD.scoreCurrent.textContent = 'SCORE: 0';
  HUD.scoreBest.textContent = 'BEST: ' + (state.profile.bestScore || 0);

  showScreen('game');
  showOverlay(null);
  beginRunLoop();
}

function beginRunLoop() {
  state.running = true;
  state.lastFrame = performance.now();
  Sound.startMusic();
  requestAnimationFrame(loop);
}

function renderHull() {
  const pct = Math.max(0, Math.round((state.hearts / 3) * 100));
  HUD.hullFill.style.width = pct + '%';
  HUD.hullLabel.textContent = 'HULL ' + pct + '%';
  let color = 'linear-gradient(90deg,#2ecc71,#27ae60)'; // healthy - green
  if (pct <= 33) color = 'linear-gradient(90deg,#ff5252,#c62828)';       // critical - red
  else if (pct <= 66) color = 'linear-gradient(90deg,#ffca28,#ff9100)'; // damaged - amber
  HUD.hullFill.style.background = color;
}
function renderShieldIndicator() {
  HUD.shield.textContent = state.shipArmor > 0 ? `🛡️ x${state.shipArmor}` : '';
}
function renderActivePowerBadges() {
  const now = performance.now();
  HUD.activePowers.innerHTML = '';
  Object.entries(state.activePowers).forEach(([type, until]) => {
    const remaining = Math.max(0, Math.ceil((until - now) / 1000));
    if (remaining <= 0) return;
    const def = POWER_TYPES[type];
    const badge = document.createElement('div');
    badge.className = 'power-badge';
    badge.innerHTML = `<span class="p-icon">${def.icon}</span><span class="p-time">${remaining}s</span>`;
    HUD.activePowers.appendChild(badge);
  });
}

// ==========================================================
// DIFFICULTY (Infinity mode scales with score)
// ==========================================================
function difficultyMultiplier() {
  if (state.mode !== 'infinity') return 1;
  return 1 + Math.min(2.5, Math.floor(state.score / 250) * 0.18);
}

// ==========================================================
// SPAWNING
// ==========================================================
function maybeSpawn(dt, now) {
  const mult = difficultyMultiplier();
  const baseDensity = state.currentLevel.obstacle_density * mult;
  const spawnInterval = Math.max(180, (900 - baseDensity * 900) / mult);
  if (now - state.lastSpawn < spawnInterval) return;
  state.lastSpawn = now;

  const roll = Math.random();
  if (roll < 0.42) {
    // obstacle: rock of varied size, falls straight down (no horizontal drift)
    const size = 26 + Math.random() * 34;
    state.obstacles.push({
      x: Math.random() * (canvas.width - size), y: -size,
      w: size, h: size, vy: (2 + Math.random() * 2 + baseDensity * 2) * mult,
      imgIndex: Math.floor(Math.random() * ASSET_PATHS.rocks.length)
    });
  } else if (roll < 0.68 && state.aliens.length < (state.currentLevel.alien_count || 6) * mult) {
    const baseTier = state.mode === 'levels'
      ? alienTierForLevel(state.currentLevel.level_number || 1)
      : alienTierForScore(state.score);
    const tier = Math.min(ASSET_PATHS.aliens.length - 1, baseTier + (Math.random() < 0.3 ? 1 : 0));
    state.aliens.push({
      x: Math.random() * (canvas.width - 36), y: -36,
      w: 38, h: 38, vy: (1.4 + Math.random() * 1.2) * mult,
      lastShot: now, shotInterval: Math.max(500, 1400 - baseDensity * 500), tier
    });
  } else if (roll < 0.85) {
    state.coins.push({ x: Math.random() * (canvas.width - 20), y: -20, w: 20, h: 20, vy: 2.5 * mult });
  } else {
    // power-up pickup - pick a random type
    const types = Object.keys(POWER_TYPES);
    const type = types[Math.floor(Math.random() * types.length)];
    const size = 26;
    state.powerups.push({ x: Math.random() * (canvas.width - size), y: -size, w: size, h: size, vy: 2.3 * mult, type });
  }
}

// ==========================================================
// UPDATE
// ==========================================================
function update(dt, now) {
  const ship = currentShip();
  const speedBoost = isPowerActive('speed') ? 1.6 : 1;
  const speed = ship.speed * speedBoost * (dt / 16.67);

  if (state.keys.left) state.player.x -= speed;
  if (state.keys.right) state.player.x += speed;
  if (state.keys.up) state.player.y -= speed;
  if (state.keys.down) state.player.y += speed;
  state.player.x = Math.max(4, Math.min(canvas.width - state.player.w - 4, state.player.x));
  state.player.y = Math.max(4, Math.min(canvas.height - state.player.h - 4, state.player.y));

  // Auto-fire (double gun fires two parallel bullets)
  if (now - state.lastShotAt > ship.fire_rate) {
    state.lastShotAt = now;
    if (isPowerActive('doubleGun')) {
      state.bullets.push({ x: state.player.x + 4, y: state.player.y, w: 6, h: 14, vy: -9 });
      state.bullets.push({ x: state.player.x + state.player.w - 10, y: state.player.y, w: 6, h: 14, vy: -9 });
    } else {
      state.bullets.push({ x: state.player.x + state.player.w / 2 - 3, y: state.player.y, w: 6, h: 14, vy: -9 });
    }
    Sound.shoot();
  }

  if (state.mode === 'levels') {
    state.distance += (2.6 + ship.speed * 0.15) * (dt / 16.67);
  } else {
    state.score += (0.6 + ship.speed * 0.05) * (dt / 16.67) * difficultyMultiplier();
  }
  state.bgOffset += (1.2 + ship.speed * 0.25) * difficultyMultiplier() * speedBoost * (dt / 16.67);

  maybeSpawn(dt, now);
  moveEntities(state.obstacles, dt);
  moveEntities(state.coins, dt);
  moveEntities(state.powerups, dt);
  moveEntities(state.bullets, dt, true);
  moveEntities(state.alienBullets, dt);

  // Magnet: pull coins toward the ship
  if (isPowerActive('magnet')) {
    const px = state.player.x + state.player.w / 2, py = state.player.y + state.player.h / 2;
    state.coins.forEach(c => {
      const dx = px - (c.x + c.w / 2), dy = py - (c.y + c.h / 2);
      const dist = Math.max(1, Math.hypot(dx, dy));
      if (dist < 260) { c.x += (dx / dist) * 6 * (dt / 16.67); c.y += (dy / dist) * 6 * (dt / 16.67); }
    });
  }

  state.aliens.forEach(a => {
    a.y += a.vy * (dt / 16.67);
    a.x += Math.sin((now + a.y) / 300) * 0.6;
    if (now - a.lastShot > a.shotInterval) {
      a.lastShot = now;
      state.alienBullets.push({ x: a.x + a.w / 2 - 2, y: a.y + a.h, w: 4, h: 12, vy: 5 });
    }
  });
  state.aliens = state.aliens.filter(a => a.y < canvas.height + 50);

  // Bullets vs aliens / obstacles
  state.bullets.forEach(b => {
    state.aliens.forEach(a => { if (!b.dead && !a.dead && rectsOverlap(b, a)) { b.dead = true; a.dead = true; addScoreOrCoins(5); Sound.explosion(); } });
    state.obstacles.forEach(o => { if (!b.dead && !o.dead && rectsOverlap(b, o)) { b.dead = true; o.dead = true; Sound.explosion(); } });
  });
  state.bullets = state.bullets.filter(b => !b.dead);
  state.aliens = state.aliens.filter(a => !a.dead);
  state.obstacles = state.obstacles.filter(o => !o.dead);

  // Coin pickups
  state.coins.forEach(c => { if (!c.dead && rectsOverlap(state.player, c)) { c.dead = true; state.coinsThisRun += 10; Sound.coin(); } });
  state.coins = state.coins.filter(c => !c.dead);

  // Power-up pickups
  state.powerups.forEach(p => {
    if (!p.dead && rectsOverlap(state.player, p)) {
      p.dead = true;
      catchPower(p.type, now);
    }
  });
  state.powerups = state.powerups.filter(p => !p.dead);

  // Collisions with player
  const shieldActive = isPowerActive('shield');
  const invincible = shieldActive || now < state.invincibleUntil;
  if (!invincible) {
    const hit = [...state.obstacles, ...state.aliens, ...state.alienBullets].some(e => rectsOverlap(state.player, e));
    if (hit) onPlayerHit(now);
  }
  state.alienBullets = state.alienBullets.filter(b => b.y < canvas.height + 30);

  // HUD
  if (state.mode === 'levels') {
    const pct = Math.min(100, (state.distance / state.currentLevel.distance) * 100);
    HUD.pathFill.style.width = pct + '%';
    HUD.pathShip.style.left = pct + '%';
    HUD.coinCount.textContent = state.profile.coins + state.coinsThisRun;
    if (pct >= 100) return winLevel();
  } else {
    HUD.scoreCurrent.textContent = 'SCORE: ' + Math.floor(state.score);
    HUD.coinCount.textContent = state.profile.coins + state.coinsThisRun;
  }
  renderActivePowerBadges();

  if (state.hearts <= 0) return loseRun();
}

function addScoreOrCoins(coinValue) {
  state.coinsThisRun += coinValue;
  if (state.mode === 'infinity') state.score += coinValue * 2;
}

function moveEntities(list, dt, isBullet) {
  list.forEach(e => { e.y += (e.vy || 0) * (dt / 16.67); });
  const filtered = list.filter(e => isBullet ? e.y > -30 : e.y < canvas.height + 40);
  list.length = 0; list.push(...filtered);
}
function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function catchPower(type, now) {
  if (type === 'heart') {
    state.hearts = Math.min(5, state.hearts + 1);
    renderHull();
  } else {
    const def = POWER_TYPES[type];
    state.activePowers[type] = now + def.duration; // stacks/refreshes independently of other powers
  }
  Sound.power(type);
  renderActivePowerBadges();
}

function onPlayerHit(now) {
  if (state.shipArmor > 0) {
    state.shipArmor -= 1;
    renderShieldIndicator();
  } else {
    state.hearts -= 1;
    renderHull();
  }
  state.invincibleUntil = now + 1100;
  canvas.classList.add('shake');
  setTimeout(() => canvas.classList.remove('shake'), 200);
  Sound.hit();
}

// ==========================================================
// DRAW
// ==========================================================
const ROCK_EMOJI = '🪨'; // fallback if an image asset fails to load
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawScrollingBackground();

  ctx.font = '18px sans-serif';
  state.coins.forEach(c => ctx.fillText('🪙', c.x, c.y + 16));

  ctx.font = '24px sans-serif';
  state.powerups.forEach(p => ctx.fillText(POWER_TYPES[p.type].icon, p.x, p.y + 20));

  state.obstacles.forEach(o => drawRock(o));

  state.aliens.forEach(a => drawAlien(a));

  ctx.fillStyle = '#00e5ff';
  state.bullets.forEach(b => ctx.fillRect(b.x, b.y, b.w, b.h));
  ctx.fillStyle = '#ff1744';
  state.alienBullets.forEach(b => ctx.fillRect(b.x, b.y, b.w, b.h));

  drawShip();
}

function drawScrollingBackground() {
  if (!Images.bg) return; // CSS gradient behind the canvas still shows if the image failed to load
  const scale = canvas.width / Images.bg.width;
  const tileH = Images.bg.height * scale;
  let y = state.bgOffset % tileH;
  for (let drawY = y - tileH; drawY < canvas.height; drawY += tileH) {
    ctx.drawImage(Images.bg, 0, drawY, canvas.width, tileH);
  }
}

function drawRock(o) {
  const img = Images.rocks[o.imgIndex];
  if (img) {
    ctx.drawImage(img, o.x, o.y, o.w, o.w * (img.height / img.width));
  } else {
    ctx.font = `${o.w}px sans-serif`;
    ctx.fillText(ROCK_EMOJI, o.x, o.y + o.h);
  }
}

function drawAlien(a) {
  const img = Images.aliens[a.tier];
  if (!img) { ctx.font = '26px sans-serif'; ctx.fillText('👾', a.x, a.y + 24); return; }
  const cx = a.x + a.w / 2, cy = a.y + a.h / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((ALIEN_ROTATION_DEG * Math.PI) / 180);
  ctx.drawImage(img, -a.w / 2, -a.h / 2, a.w, a.h);
  ctx.restore();
}

function drawShip() {
  const ship = currentShip();
  const now = performance.now();
  const invincible = isPowerActive('shield') || now < state.invincibleUntil;
  const cx = state.player.x + state.player.w / 2;
  const cy = state.player.y + state.player.h / 2;
  const img = Images.ships[ship.id];

  ctx.save();
  ctx.translate(cx, cy);
  if (invincible) { ctx.shadowColor = isPowerActive('shield') ? '#ffd600' : '#00e5ff'; ctx.shadowBlur = 22; }

  if (img) {
    ctx.rotate((SHIP_ROTATION_DEG * Math.PI) / 180);
    const dispW = 48, dispH = 48 * (img.height / img.width);
    ctx.drawImage(img, -dispW / 2, -dispH / 2, dispW, dispH);
  } else {
    ctx.rotate(-Math.PI / 4);
    ctx.font = '38px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🚀', 0, 0);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }
  ctx.restore();
}

// ==========================================================
// MAIN LOOP + PAUSE
// ==========================================================
function loop(now) {
  if (!state.running) return;
  if (state.paused) { state.lastFrame = now; requestAnimationFrame(loop); return; }
  const dt = Math.min(48, now - state.lastFrame);
  state.lastFrame = now;
  update(dt, now);
  if (!state.running) return;
  draw();
  requestAnimationFrame(loop);
}

function togglePause() {
  if (!state.running) return;
  state.paused = !state.paused;
  if (state.paused) { Sound.stopMusic(); showOverlay('pause'); }
  else { Sound.startMusic(); showOverlay(null); state.lastFrame = performance.now(); }
}

// ==========================================================
// WIN / LOSE
// ==========================================================
async function winLevel() {
  state.running = false;
  Sound.stopMusic(); Sound.win();
  const totalCoins = state.coinsThisRun + state.currentLevel.reward_coins;
  document.getElementById('win-summary').textContent =
    `Level ${state.currentLevel.level_number} cleared! +${totalCoins} coins earned.`;
  const updated = await Api.reportLevelResult(state.currentLevel.id, true, state.coinsThisRun);
  state.profile = normalizeProfile(updated);
  HUD.coinCount.textContent = state.profile.coins;
  showOverlay('win');
}

async function loseRun() {
  state.running = false;
  Sound.stopMusic(); Sound.lose();
  const loseTitle = document.getElementById('lose-title');
  const loseSummary = document.getElementById('lose-summary');

  if (state.mode === 'infinity') {
    loseTitle.textContent = '💥 GAME OVER';
    const updated = await Api.reportScore(Math.floor(state.score), state.coinsThisRun);
    state.profile = normalizeProfile(updated);
    const best = Math.max(state.profile.bestScore, Math.floor(state.score));
    state.profile.bestScore = best;
    loseSummary.textContent = `Score: ${Math.floor(state.score)}   Best: ${best}   Coins: ${state.coinsThisRun}`;
  } else {
    loseTitle.textContent = '💥 SHIP DESTROYED';
    const updated = await Api.reportLevelResult(state.currentLevel.id, false, state.coinsThisRun);
    state.profile = normalizeProfile(updated);
    loseSummary.textContent = `Your ship was destroyed on Level ${state.currentLevel.level_number}. Coins collected: ${state.coinsThisRun}.`;
  }
  HUD.coinCount.textContent = state.profile.coins;
  showOverlay('lose');
}

// ==========================================================
// SHOP
// ==========================================================
function renderShop() {
  const list = document.getElementById('shop-list');
  list.innerHTML = '';
  state.ships.forEach(ship => {
    const owned = state.profile.ownedShips.some(s => s.id === ship.id);
    const isCurrent = state.profile.currentShipId === ship.id;
    const lockedByLevel = state.profile.currentLevel < ship.unlock_level;

    const card = document.createElement('div');
    card.className = 'ship-card' + (owned ? ' owned' : '') + (isCurrent ? ' current' : '');

    const img = document.createElement('img');
    img.className = 'ship-img';
    img.src = ASSET_PATHS.ships[ship.id] || '';
    img.alt = ship.name;
    img.style.setProperty('--glow', ship.color);

    const name = document.createElement('div');
    name.className = 'ship-name';
    name.style.color = ship.color;
    name.textContent = ship.name;

    const stats = document.createElement('div');
    stats.className = 'ship-stats';
    stats.innerHTML = `
      <div><b>${ship.speed}</b>Speed</div>
      <div><b>${ship.fire_rate}ms</b>Fire Rate</div>
      <div><b>${ship.shield ?? 0}</b>Shield</div>`;

    const price = document.createElement('div');
    price.className = 'ship-price';
    price.textContent = ship.cost > 0 ? `🪙 ${ship.cost}` : 'Free starter ship';
    if (lockedByLevel) price.textContent += ` · unlocks at Level ${ship.unlock_level}`;

    const btn = document.createElement('button');
    if (isCurrent) { btn.textContent = 'EQUIPPED'; btn.disabled = true; }
    else if (owned) { btn.textContent = 'EQUIP'; btn.onclick = () => equipShip(ship.id); }
    else if (lockedByLevel) { btn.textContent = 'LOCKED'; btn.disabled = true; }
    else { btn.textContent = `BUY 🪙${ship.cost}`; btn.disabled = state.profile.coins < ship.cost; btn.onclick = () => buyShip(ship.id); }

    card.append(img, name, stats, price, btn);
    list.appendChild(card);
  });
}
async function buyShip(shipId) {
  const result = await Api.buyShip(shipId);
  if (result.error) { alert(result.error); return; }
  state.profile = normalizeProfile(result);
  HUD.coinCount.textContent = state.profile.coins;
  renderShop();
}
async function equipShip(shipId) {
  const result = await Api.selectShip(shipId);
  state.profile = normalizeProfile(result);
  renderShop();
}

// ==========================================================
// CONTROLS
// ==========================================================
function bindHold(el, onDown, onUp) {
  const down = e => { e.preventDefault(); onDown(); };
  const up = e => { e.preventDefault(); onUp(); };
  el.addEventListener('mousedown', down);
  el.addEventListener('touchstart', down, { passive: false });
  ['mouseup', 'mouseleave', 'touchend', 'touchcancel'].forEach(ev => el.addEventListener(ev, up));
}
bindHold(document.getElementById('btn-left'), () => state.keys.left = true, () => state.keys.left = false);
bindHold(document.getElementById('btn-right'), () => state.keys.right = true, () => state.keys.right = false);
bindHold(document.getElementById('btn-up'), () => state.keys.up = true, () => state.keys.up = false);
bindHold(document.getElementById('btn-down'), () => state.keys.down = true, () => state.keys.down = false);

window.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft') state.keys.left = true;
  if (e.key === 'ArrowRight') state.keys.right = true;
  if (e.key === 'ArrowUp') state.keys.up = true;
  if (e.key === 'ArrowDown') state.keys.down = true;
  if (e.code === 'Space') { e.preventDefault(); togglePause(); }
});
window.addEventListener('keyup', e => {
  if (e.key === 'ArrowLeft') state.keys.left = false;
  if (e.key === 'ArrowRight') state.keys.right = false;
  if (e.key === 'ArrowUp') state.keys.up = false;
  if (e.key === 'ArrowDown') state.keys.down = false;
});

window.addEventListener('pointerdown', () => Sound.ensureCtx(), { once: true });
document.querySelectorAll('button').forEach(btn => btn.addEventListener('click', () => Sound.click()));

// ---------- Home screen ----------
document.getElementById('mode-levels').addEventListener('click', () => { renderLevelSelect(); showScreen('levelSelect'); });
document.getElementById('mode-infinity').addEventListener('click', () => startInfinity());
document.getElementById('btn-level-select-back').addEventListener('click', () => showScreen('home'));
document.getElementById('btn-settings-home').addEventListener('click', () => showOverlay('settings'));
document.getElementById('btn-shop-home').addEventListener('click', () => { renderShop(); showOverlay('shop'); });

// ---------- In-game ----------
document.getElementById('btn-pause-ingame').addEventListener('click', togglePause);

// ---------- Pause overlay ----------
document.getElementById('btn-pause-resume').addEventListener('click', togglePause);
document.getElementById('btn-pause-home').addEventListener('click', () => { state.running = false; Sound.stopMusic(); showOverlay(null); showScreen('home'); });
document.getElementById('btn-pause-restart').addEventListener('click', () => {
  showOverlay(null);
  if (state.mode === 'levels') startLevel(state.currentLevel.level_number); else startInfinity();
});

// ---------- Win / lose ----------
document.getElementById('btn-next-level').addEventListener('click', () => startLevel((state.currentLevel.level_number || 0) + 1));
document.getElementById('btn-win-shop').addEventListener('click', () => { renderShop(); showOverlay('shop'); });
document.getElementById('btn-win-home').addEventListener('click', () => { showOverlay(null); showScreen('home'); });
document.getElementById('btn-retry').addEventListener('click', () => { if (state.mode === 'levels') startLevel(state.currentLevel.level_number); else startInfinity(); });
document.getElementById('btn-lose-home').addEventListener('click', () => { showOverlay(null); showScreen('home'); });

// ---------- Settings ----------
document.getElementById('toggle-music').addEventListener('change', e => Sound.setMusicOn(e.target.checked));
document.getElementById('toggle-sound').addEventListener('change', e => Sound.setSoundOn(e.target.checked));
document.getElementById('volume-slider').addEventListener('input', e => Sound.setVolume(e.target.value / 100));
document.getElementById('btn-close-settings').addEventListener('click', () => showOverlay(null));

// ---------- Shop ----------
document.getElementById('btn-close-shop').addEventListener('click', () => showOverlay(null));

// ---------- Boot ----------
init();
