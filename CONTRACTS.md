# CONTRACTS.md — the one thing everyone depends on

Changing anything in this file needs a quick OK from all five of us.

## Every stage looks like this

```js
// stages/<id>/index.js
export default {
  id: 'hermes', name: 'Hermes', rank: 'Astronaut Trainee',
  start(game) { /* full stage, 3-5 min */ },
  demo(game)  { /* judge version, 15-35 s */ }
}
```

## What `game` gives every stage (Person 1 builds it — `/core`)

```js
game.oxygen.change(-10)          // 0-100
game.progress.change(+10)        // 0-100, 100 = stage done
game.plugs.set(4)                // energy plugs available
game.storm.light('red')          // green | yellow | red
game.ui.card({ title, text, choices })   // Person 5 draws it
game.ui.buoy('Suits only carry so much air!')
game.data.storm()                // a real storm (Person 4)
game.web.window('nbl')           // SerpAPI card (Person 4)
game.demo.check('every-choice-costs')    // ticks the judge checklist
game.finish({ stars, passed })
```

## Data rows

- `storms.json` rows: `donkiId, date, kind, strength, kidText`
- `web_cache.json` rows: `queryId, foundOn, title, source, url, image`
- `player.json` (saved): `name, suit, visor, stickers, backpack, badges`

---

## Proposed additions (all optional and backwards-compatible) — need the team's OK

Building Hermes showed the stages need a few more things from `game`. None of them
change the calls above; a stage that ignores them still works.

| Addition | Why |
|---|---|
| `game.root` | The DOM element the stage draws its 3D scene into. |
| `game.mode` | `'easy' \| 'hard' \| 'demo'`, so a stage can show more or fewer hints. |
| `game.rules` | This stage's numbers from `/core/rules.js`, already adjusted for the mode. Balancing never means editing a stage. |
| `game.player` | The saved `player.json` (read-only), so gloves and sleeves use my suit colour. |
| `game.running` | `false` once the stage has finished or hit "Sim over". Stop your loop when it flips. |
| `game.oxygen.change(delta, reason)` | Optional `reason` (`'working'`, `'breathing'`, `'refill'`, `'storm'`…). The engine uses it to pick the "one moment that made the difference" on the Sim over screen. |
| `game.ui.prompt(text \| null)` | The small "Hold [E] to fix" hint on the visor (`[E]` draws as a key). |
| `game.ui.buoy(text, { interrupt: true })` | Optional second argument: an urgent line (safety warning, big win) skips Buoy's queue. Wrap words in `*stars*` to highlight them. |
| `game.ui.target(on)` | Turns the crosshair into a ring when you're aiming at something you can use. |
| `game.ui.pause(on, onResume)` | The "Paused · click to keep training" screen. |
| `game.ui.busy` | `true` while a card is on screen. Pause your stage's clock while it is. |
| `start(game)` / `demo(game)` may **return a cleanup function** | The engine calls it on finish, Sim over and Try again, so the stage can dispose its renderer and listeners. |
| optional `realNumbers: [{ label, value, source, url }]` on the stage | Hard mode's "Real numbers" button shows these. |

## Judge checklist ids (for `game.demo.check`)

| id | Checklist item |
|---|---|
| `every-choice-costs` | 1. Real trade-offs: every choice costs something |
| `two-bars` | 2. 2-3 resources only: two bars plus plugs and storm light |
| `play-over-time` | 3. Play over time: Moon base days where choices add up |
| `replayability` | 4. Replayability: random real storms; "Sim over, try again" |
| `real-dataset` | 5. At least one real dataset (DONKI) |
| `real-world-link` | 6. Safe-room (shielding) choice tied to real space weather |
| `honest-data` | 7. Saved storms show their date; only live data says LIVE |
| `attribution` | 8. "Where's this from?" Data Sources page |
| `plain-language` | 9. Buoy explains each science word where it appears |
| `browser-playable` | 10. No download, no account |
| `teaches-one-thing` | 11. "That's why astronauts can't just use unlimited power" |
| `what-really-happened` | 12. A "What really happened" moment linked to real NASA data |
| `easy-hard-modes` | 13. Easy and Hard modes |
| `intro-character` | 14. Intro at Olympus Academy and the 3D character maker |
| `five-topics` | 15. All five challenge topics |

## URL switches

- `/?stage=hermes` — run one stage alone (skips the loading screen).
- `&mode=easy | hard | demo` — pick the mode (default `easy`).
