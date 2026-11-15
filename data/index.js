// Person 4 owns this folder. These are working stand-ins so stages can call
// game.data and game.web today; swap the insides, keep the function shapes.

import storms from './storms.json';
import webCache from './web_cache.json';

// Kid words for each preset search (kids never type searches).
const PLACES = {
  nbl: {
    eyebrow: 'Real world window',
    title: 'The real training pool',
    text: "You just trained in a copy of NASA's *Neutral Buoyancy Laboratory* in Houston, Texas. Astronauts really practise spacewalks there.",
  },
  zerog: {
    eyebrow: 'Real world window',
    title: 'The real zero-G plane',
    text: "NASA really flies planes in big hills so people inside float, about 20 seconds at a time. One was called the *Weightless Wonder*; lots of people call them the *Vomit Comet*.",
  },
  lab: {
    eyebrow: 'Real world window',
    title: "The station's real robot arm",
    text: 'The space station really has a giant robot arm called *Canadarm2*. Astronauts steer it from the *Cupola* window, and it catches cargo ships and moves experiments, just like you did.',
  },
  ship: {
    eyebrow: 'Real world window',
    title: 'The real spaceship simulator',
    text: "The Artemis II astronauts practised in NASA's *Orion simulator* in Houston before flying around the Moon. Their real capsule has a radiation alarm called *HERA*, and the crew practised building a storm shelter out of supply bags, like you did.",
  },
  moon: {
    eyebrow: 'Real world window',
    title: "The real Moon's south pole",
    text: "NASA's *Artemis* missions plan to send astronauts to the Moon's *south pole*, where dark craters hold *ice*. Living there means getting through the long, freezing *lunar night*, just like you did.",
  },
};

export function createData() {
  return {
    ready: () => Promise.resolve(),
    // A real storm from NASA DONKI (rows: donkiId, date, kind, strength, kidText).
    // storms.json is empty until Person 4 saves real DONKI rows; never invent one.
    storm() {
      if (!storms.length) return null;
      return storms[Math.floor(Math.random() * storms.length)];
    },
  };
}

export function createWeb(ui) {
  return {
    window(queryId) {
      const place = PLACES[queryId];
      const rows = webCache.filter((r) => r.queryId === queryId);
      if (!place || !rows.length) return Promise.resolve(null);
      return ui.card({
        eyebrow: place.eyebrow,
        title: place.title,
        text: place.text,
        links: rows.map((r) => ({ title: r.title, url: r.url, source: r.source, foundOn: r.foundOn })),
        note: rows.some((r) => r.sample) ? 'Saved links. Live news cards arrive with the SerpAPI search.' : undefined,
        choices: [{ id: 'ok', label: 'Cool!' }],
      });
    },
  };
}
