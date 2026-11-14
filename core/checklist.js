// The judge checklist. Ids must match CONTRACTS.md.

export const CHECKLIST = [
  { id: 'every-choice-costs', group: 'The core game', label: 'Real trade-offs: more Progress always means less Oxygen' },
  { id: 'two-bars', group: 'The core game', label: 'Two bars only, plus energy plugs and a storm light' },
  { id: 'play-over-time', group: 'The core game', label: 'Play over time: Moon base days add up' },
  { id: 'replayability', group: 'The core game', label: 'Replayable: random real storms, "Sim over, try again"' },
  { id: 'real-dataset', group: 'Real NASA data', label: 'A real space storm from NASA DONKI' },
  { id: 'real-world-link', group: 'Real NASA data', label: 'Safe-room choice tied to real space weather' },
  { id: 'honest-data', group: 'Real NASA data', label: 'Saved storms show their date; only live data says LIVE' },
  { id: 'attribution', group: 'Real NASA data', label: '"Where\'s this from?" Data Sources page' },
  { id: 'plain-language', group: 'Made for kids 7-12', label: 'Buoy explains each science word where it appears' },
  { id: 'browser-playable', group: 'Made for kids 7-12', label: 'Plays in the browser: no download, no account' },
  { id: 'teaches-one-thing', group: 'Made for kids 7-12', label: 'Teaches one real thing about astronaut limits' },
  { id: 'what-really-happened', group: 'Bonus points', label: '"What really happened" moment from real NASA data' },
  { id: 'easy-hard-modes', group: 'Bonus points', label: 'Easy and Hard modes' },
  { id: 'intro-character', group: 'Challenge topics', label: 'Olympus Academy intro and 3D character maker' },
  { id: 'five-topics', group: 'Challenge topics', label: 'Life support, shielding, power, food, comms delay' },
];

const IDS = new Set(CHECKLIST.map((item) => item.id));

export function isChecklistId(id) {
  return IDS.has(id);
}
