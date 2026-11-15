// SerpAPI helpers, used by tools/fetch-web.js to gather facts for the Real World Window and Zeus Jr.
// The searches run once, ahead of time (npm run fetch:web); the game only reads the saved results.
// Kid-safe rules (from the team plan): kids never type searches (presets only), SafeSearch is
// always on, results only come from trusted sites, and every result says where and when it was found.

import { isKidSafeName } from '../core/save.js';

// One preset search per Real World Window, each limited to one space agency's site.
// (SerpApi's DuckDuckGo engine respects site:; in our tests Google and Bing ignored it.)
export const PRESETS = {
  nbl: 'Neutral Buoyancy Laboratory astronaut spacewalk training site:nasa.gov',
  zerog: 'parabolic flight weightless astronauts reduced gravity site:nasa.gov',
  lab: 'Canadarm2 robotic arm astronauts space station site:asc-csa.gc.ca',
  ship: 'Artemis II astronauts Orion simulator training site:nasa.gov',
  moon: 'Artemis Moon south pole astronauts site:nasa.gov',
};

const TRUSTED = [
  'nasa.gov',
  'esa.int',
  'asc-csa.gc.ca',
  'canada.ca',
  'jaxa.jp',
  'si.edu',
  'noaa.gov',
  'smithsonianmag.com',
  'nationalgeographic.com',
  'space.com',
  'bbc.com',
  'bbc.co.uk',
  'pbs.org',
];

export function isTrusted(url) {
  let host;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return TRUSTED.some((d) => host === d || host.endsWith(`.${d}`));
}

// Turn a search snippet into one clean line for Zeus Jr.: whole sentences only (nothing cut off
// with "…"), no date or page title stuck on the front, at most ~170 characters.
// Returns null if there isn't a complete, useful sentence.
export function cleanSnippet(text, title = '') {
  let s = String(text ?? '')
    .replace(/\s+/g, ' ')
    .replace(/^([A-Z][a-z]{2} \d{1,2}, \d{4}|\d+ (?:hours?|days?|weeks?|months?|years?) ago)\s*[—–-]\s*/, '')
    .trim();
  const t = String(title).replace(/\s+/g, ' ').trim();
  // "The history of Canadarm2 | Canadian Space Agency" -> also try "The history of Canadarm2"
  for (const head of [t, t.split(/\s[-|–—:]\s/)[0]]) {
    if (head && s.toLowerCase().startsWith(`${head.toLowerCase()} `)) {
      s = s.slice(head.length).trim();
      break;
    }
  }
  s = s.split(/\s*(?:\.\.\.|…)/)[0]; // anything after "..." is a fragment
  const sentences = s.match(/\S.*?[.!?]+(?=\s|$)/g) ?? []; // a sentence ends at . ! ? before a space (so 6.2 stays whole)
  let out = '';
  for (const sentence of sentences) {
    const next = `${out} ${sentence.trim()}`.trim();
    if (next.length > 170) break;
    out = next;
  }
  if (out && !/^[A-Z0-9"']/.test(out)) out = out[0].toUpperCase() + out.slice(1);
  return out.length >= 40 ? out : null;
}

// The line has to be about astronauts or space, not a homework question or a staff memo.
const ON_TOPIC = /astronaut|spacewalk|weightless|gravity|space station|\bISS\b|\bmoon\b|lunar|orion|artemis|canadarm|robot|crew|rocket|spacecraft|spacesuit|neutral buoyancy|float/i;

const AGENCIES = [
  ['nasa.gov', 'NASA'],
  ['esa.int', 'ESA'],
  ['asc-csa.gc.ca', 'Canadian Space Agency'],
  ['canada.ca', 'Government of Canada'],
  ['jaxa.jp', 'JAXA'],
  ['si.edu', 'Smithsonian'],
  ['noaa.gov', 'NOAA'],
];
function sourceName(url) {
  const host = new URL(url).hostname.replace(/^www\./, '');
  const hit = AGENCIES.find(([d]) => host === d || host.endsWith(`.${d}`));
  return hit ? hit[1] : host;
}

export function pickResults(json, foundOn) {
  const out = [];
  const seen = new Set();
  for (const r of json?.organic_results ?? []) {
    if (!r?.link || !isTrusted(r.link) || tooTechnical(r.link)) continue;
    const text = cleanSnippet(r.snippet, r.title);
    if (!text || !ON_TOPIC.test(text) || !isKidSafeName(text) || !isKidSafeName(r.title ?? '')) continue;
    const source = sourceName(r.link);
    const page = r.link.replace(/[#?].*$/, '').replace(/\/$/, '');
    if (seen.has(page) || seen.has(text)) continue; // no repeats
    seen.add(page);
    seen.add(text);
    out.push({ title: String(r.title ?? source), text, source, url: r.link, foundOn });
    if (out.length === 4) break;
  }
  return out;
}

// Research papers and PDFs are too dense for a 7-year-old.
function tooTechnical(url) {
  return /\.pdf($|[?#])/i.test(url) || /(^|\.)(ntrs|techport)\.nasa\.gov$/i.test(new URL(url).hostname);
}

export function serpUrl(presetId, key) {
  const q = PRESETS[presetId];
  if (!q) throw new Error(`Not a preset search: ${presetId}`);
  const u = new URL('https://serpapi.com/search.json');
  u.searchParams.set('engine', 'duckduckgo');
  u.searchParams.set('q', q);
  u.searchParams.set('safe', '1'); // strict SafeSearch
  u.searchParams.set('kl', 'us-en');
  u.searchParams.set('api_key', key);
  return u.toString();
}

// Put fresh search results for one stage into the saved rows (data/web_cache.json).
// Only that stage's old SerpApi rows are replaced; hand-picked links stay. An empty search keeps the old rows.
export function mergeRows(saved, presetId, results) {
  if (!results.length) return saved;
  const kept = saved.filter((r) => !(r.queryId === presetId && r.via === 'SerpApi'));
  return [...kept, ...results.map((r) => ({ queryId: presetId, foundOn: r.foundOn, title: r.title, source: r.source, url: r.url, image: null, text: r.text, via: 'SerpApi' }))];
}
