# Path to Olympus

Make your own astronaut, train like the real ones, then prove it on the Moon,
where every choice costs oxygen and every storm really happened.

A first-person astronaut training game for kids 7-12. Plays in the browser: no download, no account.

## The challenge: Build a Junior Astronaut Mission Trainer

Space-themed STEM content often oversimplifies the engineering trade-offs that define a real mission or presents them at a level too complex to hold a young learner's attention. Few tools make those trade-offs both tangible and fun. Your challenge is to design and build an interactive game or app that lets students run a lunar or Martian outpost, balancing competing demands like life support, radiation shielding, power, and food production, so they experience firsthand the decisions that determine whether a mission fails or succeeds.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

| URL | What you get |
|---|---|
| `/` | Loading screen, then pick Easy, Hard or Judge Demo |
| `/?stage=hermes` | One stage on its own (for stage builders) |
| `/?stage=hermes&mode=hard` | Same, in Hard mode (shows the Real numbers button) |
| `/?stage=hermes&mode=demo` | That stage's 15-35 s judge version, with the checklist on screen |

```bash
npm test           # Vitest: engine + Hermes trade-off numbers
npm run build      # static build in dist/ (GitHub Pages ready, base './')
```

## Who owns what

Only edit your own folders. `CONTRACTS.md` is the one shared file; changing it needs an OK from all five.

| Person | Job | Folders |
|---|---|---|
| 1 · Harihar | Engine: bars, plugs, storm light, save, stage loader, modes, Judge Demo runner | `core/` |
| 2 · Aanya | Stages 1-3 | `stages/hermes`, `stages/odysseus`, `stages/dioscuri` |
| 3 · Abhinav | Stages 4-6 | `stages/hera`, `stages/artemis`, `stages/apollo` |
| 4 · Aniketh | Data + SerpAPI | `data/`, `api/`, `tools/`, `DATA_SOURCES.md` |
| 5 · Nivedhya | Look, intro, 3D character, HUD, Buoy, cards, sounds | `ui/`, `assets/`, `intro/` |

## How the pieces fit

- **A stage is just a folder.** Add `stages/<id>/index.js` exporting `{ id, name, rank, start(game), demo(game) }`
  and the engine finds it automatically; no `core/` edit needed. See `stages/hermes/` for a full example.
- **Every number lives in `core/rules.js`**, with `easy`, `hard` and `demo` overrides per stage. Stages read
  them from `game.rules`, so balancing never means editing a stage.
- **The UI is swappable.** The engine only talks to `ui/index.js` through the object `createUI()` returns.

## What's built

- **Loading screen** (`intro/loading.js`): the six stages as mission patches on a path to the Moon. The
  stitching thread is the real loading bar. Ends in Easy / Hard / Judge Demo.
- **Engine** (`core/`): Oxygen and Progress bars, Sim over with "the moment that made the difference",
  Try again, stars, save (`player.json` + finished stages), modes, Judge Demo runner and checklist.
- **Stage 1, Hermes** (`stages/hermes/`): NASA's Neutral Buoyancy Lab pool, built to real proportions
  (202 × 102 × 40 ft). Swim to 3 broken panels and hold E to fix them; working burns oxygen 5× faster than
  floating (5× in Easy, 4× in Hard), and the air station refills you, slowly.

- **Stage 2, Odysseus** (`stages/odysseus/`): the zero-G plane. The plane flies hills: heavy (1.8 g, lie still),
  then about 20 s of floating. Catch the tools that float out of the toolbox; pushing yourself around burns
  oxygen, gliding doesn't. Then a generator switches off: unplug the extra machines on the power panel so the
  air machine and camera can run, and pick air first when the generator flickers down to 1 plug.

## Still placeholder

- `data/storms.json` is empty until real DONKI rows are saved (never invent a storm).
- `data/web_cache.json` has two hand-picked NASA links for the pool; SerpAPI cards replace them.
- The Olympus Academy intro, character maker and fly-through slot in before Stage 1 in `core/main.js`.
- Visuals in `ui/` are working placeholders for Person 5 to restyle.
