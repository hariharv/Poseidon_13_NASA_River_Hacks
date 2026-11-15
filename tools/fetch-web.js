// Gathers real-world facts for the Real World Window and Zeus Jr. with SerpApi, ONE TIME,
// and saves them in data/web_cache.json. The game never searches while kids play; it only
// reads the saved results and says they were found with SerpApi (and when).
//
//   npm run fetch:web            (needs SERPAPI_KEY in .env.local or the environment)
//
// Uses 5 searches (one per stage) of the free plan's 250 a month. Re-run any time to refresh.

import { readFileSync, writeFileSync } from 'node:fs';
import { PRESETS, serpUrl, pickResults, mergeRows } from './serp.js';

const CACHE = new URL('../data/web_cache.json', import.meta.url);

function readKey() {
  if (process.env.SERPAPI_KEY) return process.env.SERPAPI_KEY.trim();
  try {
    const line = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
      .split('\n')
      .find((l) => l.startsWith('SERPAPI_KEY='));
    return line?.slice('SERPAPI_KEY='.length).trim().replace(/^["']|["']$/g, '') || null;
  } catch {
    return null;
  }
}

const key = readKey();
if (!key) {
  console.error('No SERPAPI_KEY found. Add a line SERPAPI_KEY=... to .env.local, then run this again.');
  process.exit(1);
}

const foundOn = new Date().toISOString().slice(0, 10);
let rows = JSON.parse(readFileSync(CACHE, 'utf8'));
for (const id of Object.keys(PRESETS)) {
  try {
    const r = await fetch(serpUrl(id, key), { signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error(`SerpApi answered ${r.status}`);
    const results = pickResults(await r.json(), foundOn);
    rows = mergeRows(rows, id, results);
    console.log(`${id}: ${results.length} result(s) kept`);
  } catch (err) {
    console.log(`${id}: search failed (${err.message}), kept the old rows`); // never print the URL: it holds the key
  }
}
writeFileSync(CACHE, `${JSON.stringify(rows, null, 2)}\n`);
console.log(`Saved to data/web_cache.json (found on ${foundOn}).`);
