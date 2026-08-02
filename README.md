# Galaxy Runner — 2D Space Shooter

A single-player or local 2-player 2D space shooter with two modes:

- **Levels** — dodge rocks and aliens along a path (shown top of screen).
  Reach the goal to win and earn Rupees.
- **Infinity** — no end. Choose a difficulty (Easy / Normal / Hard), then
  1 or 2 players, then your ship (Blue or Purple). Score climbs the longer
  you survive, and speed/difficulty ramp up automatically as it grows.

Crash into a rock/alien/bullet and you lose a heart (after your ship's
armor is used up first, if its level has any). Run out of hearts = game over.

## Camera / view angle
The game now renders in a **high-angle (~45°) perspective** instead of a
flat overhead view. Objects spawn small and compressed toward the center
near the top of the screen ("far away") and grow to full size/spacing as
they fall toward the player at the bottom ("near") — the classic pseudo-3D
look of arcade rail shooters, without needing new 3D-rendered art. A subtle
dark gradient near the top ("horizon fog") reinforces the sense of depth.
Collision boxes stay in plain, unprojected coordinates, and the projection
is defined so it matches 1:1 exactly at the player's row — so hitboxes and
visuals line up perfectly right where it matters, and only distort for
things still approaching from a distance.

## Ships: Blue Fighter & Purple Fighter
There are two ships, not five. Each has its own independent progress:
- **Ship Level** 1 → 5
- Three upgradeable abilities — **Attack, Health, Speed** — each 0 → 10,
  paid for with **Rupees** (earned by playing)
- Upgrade cost rises with each ability level *and* with the ship's overall
  tier, so higher-level ships cost more to keep upgrading
- Once **all three abilities hit 10/10**, a **⚡ BREAKTHROUGH** button
  appears in the Shipyard — tapping it advances the ship to its next
  level (max 5) and resets all three abilities back to 0 for the next tier's grind

Open the 🛠️ Shipyard from the home screen (top-right) to upgrade, equip,
or switch between Blue and Purple at any time.

## Infinity mode setup wizard
Tapping the Infinity card on the home screen walks through:
1. **Difficulty** — Easy / Normal / Hard (changes the base spawn rate and
   fall speed multiplier)
2. **Players** — 1 Player or 2 Players
3. **Ship** — Blue or Purple (1-player only; in 2-player, Player 1 always
   flies Blue and Player 2 always flies Purple)
4. **Confirm & Start**

### 2-player controls
Both ships fly on the same screen with independent hull bars in the HUD.
- **Player 1**: Arrow keys, or the on-screen D-pad in the **bottom-right**
- **Player 2**: WASD keys, or the on-screen D-pad in the **bottom-left**
  (only shown in 2-player mode)
- **Space** always pauses/resumes, regardless of player count

The run continues as long as at least one ship is alive; it ends once both
are destroyed.

## Power-ups
Power-ups fall like coins and activate automatically on contact. Several
can be active on the same ship at once, with live countdown badges shown
on the left-middle of the screen:
- 🔫 Double Gun — fires two bullets at once
- 💨 Speed — temporary movement boost
- 🧲 Magnet — pulls nearby coins toward your ship
- 🛡️ Shield — temporary full invincibility
- ❤️ Heart — instantly restores a life

## Art assets (frontend/assets/)
- `bg-space.jpg` — a continuous scrolling background built from 9
  deep-space photos stitched end-to-end with feathered crossfades at each
  seam, so it reads as one long flight through space rather than separate
  images. Loops back to the start once it reaches the bottom.
- `ships/blue.png`, `ships/purple.png` — the two player ships
- `aliens/` — 5 enemy tiers (saucer_small → saucer_medium → frigate →
  catn → cruiser). Levels mode ramps through them by level number;
  Infinity mode ramps them automatically as score rises.
- `rocks/` — 3 asteroid variants cropped from the background art itself,
  so they blend into the scrolling backdrop

## Structure
```
space-shooter/
├── frontend/                 # HTML5 canvas game (pure JS, no build step)
│   ├── index.html
│   ├── style.css
│   ├── game.js
│   └── assets/
│       ├── bg-space.jpg
│       ├── ships/{blue,purple}.png
│       ├── aliens/*.png
│       └── rocks/*.png
├── backend/                  # Express REST API (Levels progress + best score)
│   ├── server.js
│   ├── db.js
│   └── package.json
└── database/
    └── schema.sql             # SQLite schema + seed data (levels)
```

## Running it

### 1. Backend + database (optional — Levels progress & best score)
```bash
cd backend
npm install
npm start
# API now running on http://localhost:4000
```

### 2. Frontend
```bash
cd frontend
npx serve .
# or: python3 -m http.server 8080
```
Open the printed URL in a browser. If the backend isn't running, the game
still works fully — it falls back to `localStorage` automatically.

## Scope note on this version
To keep this update shippable, ship levels/abilities and Rupees are tracked
in the browser (`localStorage`), not yet round-tripped through the backend
database. The backend's older `spaceships` / `buy-ship` / `select-ship`
endpoints are no longer called by the frontend (harmless to leave in place,
or remove later). Levels-mode rewards and Infinity best-scores still sync
to the backend as before. Persisting the new ability-upgrade system
server-side (e.g. a `character_progress` table keyed by ability levels
instead of ship IDs) would be a natural next step if you want progress to
follow a player across devices.

## Troubleshooting: "the buttons don't do anything"
Make sure `index.html`, `style.css`, and `game.js` are uploaded together in
the same folder — `index.html` loads `game.js` via `<script src="game.js">`,
and if that file is missing or 404s, the whole game (and every button)
will silently fail. Check the browser console for a 404 to confirm.
