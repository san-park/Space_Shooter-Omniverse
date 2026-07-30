# Galaxy Runner — 2D Space Shooter

Single-player 2D space shooter with two modes:
- **Levels** — dodge rocks and aliens along a path (shown top of screen),
  reach the goal to win, unlock the next level and new ships.
- **Infinity** — no end. Score climbs the longer you survive; speed and
  difficulty scale up automatically as your score grows. Current + best
  score shown at the top.

Crash into a rock/alien/bullet and you lose a heart (after your ship's
armor/shield stat is used up first). Run out of hearts = game over.

## What's new in this version
- **Home screen** with two big mode cards (Levels / Infinity) and
  ⚙️ Settings + 🛒 Shop buttons in the top-right corner
- **Settings**: separate Music on/off, Sound Effects on/off, and a volume slider
- **Power-ups** fall down during play and activate automatically on contact,
  and can **stack** (several active at once), with live countdown badges on
  the left-middle of the screen:
  - 🔫 Double Gun — fires two bullets at once
  - 💨 Speed — temporary movement boost
  - 🧲 Magnet — pulls nearby coins toward your ship
  - 🛡️ Shield — temporary full invincibility
  - ❤️ Heart — instantly restores a life
- **Ship armor**: each ship also has a base "Shield" stat (shown on its
  shop card) — that many hits are absorbed before a heart is lost, reset
  every run
- **Pause/Resume**: press **Space** any time during play (or tap ⏸ in the
  HUD). The pause screen shows Home ▪ Resume ▪ Restart
- Ship now renders **vertically** (nose pointing up) instead of sideways
- Obstacles are rocks (different sizes) that fall straight down — no
  side-to-side drift
- Movement controls (▲▼◀▶) moved to the **bottom-right** corner; the old
  standalone ⚡ POWER button is gone (powers now auto-activate)
- **Shop** is a vertically scrollable list of ship cards — each shows the
  ship image on top, then Speed / Fire Rate / Shield stats, price, and a
  Buy/Equip button

## Structure
```
space-shooter/
├── frontend/         # HTML5 canvas game (pure JS, no build step)
│   ├── index.html
│   ├── style.css
│   └── game.js
├── backend/           # Express REST API
│   ├── server.js
│   ├── db.js
│   └── package.json
└── database/
    └── schema.sql     # SQLite schema + seed data (ships & levels)
```

## Sound
All sound effects and the background music loop are **synthesized in the
browser** with the Web Audio API (`Sound` object at the top of `game.js`) —
there are no `.mp3`/`.wav` files to upload or license. Effects: shooting,
explosions, coin pickup, power-up, taking a hit, and win/lose stingers.
A 🔊 mute button sits in the top HUD (state is remembered via `localStorage`).

> Note: browsers block audio until the first tap/click on the page — the
> game listens for that automatically, so sound just works once you touch
> the screen (this is a browser rule, not a bug).

## Controls
- **◀ / ▶ / ▲ / ▼** on-screen buttons (or arrow keys) — move the ship
  in all 4 directions.
- **⚡ POWER** button (or Space bar) — activates a temporary shield /
  screen-clear burst once the power meter (top-right bar) is full.
  The meter fills from time, or instantly from purple ⚡ orbs.

## Running it

### 1. Backend + database
The database is plain SQLite; it's created automatically the first time
the server starts (schema + seed ships/levels come from `database/schema.sql`).

```bash
cd backend
npm install
npm start
# API now running on http://localhost:4000
```

### 2. Frontend
The frontend is static — just serve the `frontend/` folder. Easiest option:

```bash
cd frontend
npx serve .
# or: python3 -m http.server 8080
```

Then open the printed URL in your browser (or on your phone, if serving
on your local network).

> If the backend isn't running, the game still works — it automatically
> falls back to `localStorage` for saving coins/ships/progress, so you can
> try the whole game with just the `frontend/` folder open directly in a
> browser.

## API endpoints (backend/server.js)
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/player/:username` | Get (or auto-create) a player profile |
| GET | `/api/spaceships` | List all ships in the shop (now includes `shield`) |
| GET | `/api/levels` | List all levels |
| POST | `/api/player/:username/buy-ship` | Buy a ship with coins `{shipId}` |
| POST | `/api/player/:username/select-ship` | Equip an owned ship `{shipId}` |
| POST | `/api/player/:username/level-result` | Report win/crash `{levelId, won, coinsCollected}` |
| POST | `/api/player/:username/score` | Report an Infinity-mode run `{score}` — keeps the best score |
| POST | `/api/player/:username/hearts` | Manually set current hearts `{hearts}` |

## Database (database/schema.sql)
- `players` — coins, hearts, current ship/level, **best_score** (Infinity mode)
- `spaceships` — shop catalogue (cost, speed, power, fire rate, **shield**, unlock level)
- `player_spaceships` — which ships each player owns
- `levels` — distance to goal, alien count, obstacle density, coin reward
- `player_progress` — per-level completion/best score/attempts

> If you already have an existing `game.db` from an earlier version,
> `backend/db.js` automatically adds the new `shield` and `best_score`
> columns on next start — no need to delete your data.

## Troubleshooting: "the buttons don't do anything"
This almost always means **`game.js` wasn't uploaded** alongside
`index.html` and `style.css`. All three files in `frontend/` must sit in the
same folder on GitHub Pages (or wherever you host it):
```
index.html
style.css
game.js
```
`index.html` loads `game.js` in a `<script src="game.js"></script>` tag at
the bottom — if that file is missing or 404s, every button, the whole game
loop, and the sound engine will silently fail with no visible error (check
your browser console for a 404 to confirm).

## Extending it
- Add more rows to `spaceships` / `levels` in `schema.sql` to add content —
  the frontend reads both lists dynamically, no code changes needed.
- Swap the emoji sprites in `game.js` (`draw()` function) for real image
  assets by drawing `ctx.drawImage(...)` instead of `ctx.fillText(...)`.
- Add sound effects, a pause button, or a leaderboard endpoint the same
  way the existing endpoints are structured.
