import { describe, it, expect } from 'vitest';
import { PRESETS, isTrusted, cleanSnippet, pickResults, serpUrl, mergeRows } from './serp.js';

describe('SerpAPI helpers (the key stays on the server)', () => {
  it('has a preset search for every Real World Window in the game', () => {
    for (const id of ['nbl', 'zerog', 'lab', 'ship', 'moon']) expect(PRESETS[id], id).toBeTruthy();
  });

  it('only trusts space agencies and a few big science sites', () => {
    expect(isTrusted('https://www.nasa.gov/x')).toBe(true);
    expect(isTrusted('https://science.nasa.gov/moon')).toBe(true);
    expect(isTrusted('https://www.esa.int/Education')).toBe(true);
    expect(isTrusted('https://nasa.gov.evil.example/x')).toBe(false);
    expect(isTrusted('https://randomblog.example/nasa')).toBe(false);
    expect(isTrusted('not a url')).toBe(false);
  });

  it('turns a search snippet into one short, kid-sized line', () => {
    expect(cleanSnippet('Mar 3, 2024 — Astronauts train in a giant pool. It holds 6.2 million gallons of water and a full-size station mock-up for practice.')).toBe(
      'Astronauts train in a giant pool. It holds 6.2 million gallons of water and a full-size station mock-up for practice.',
    );
    const long = 'Astronauts practise spacewalks underwater. '.repeat(10);
    expect(cleanSnippet(long).length).toBeLessThanOrEqual(171);
    expect(cleanSnippet('Too short.')).toBe(null);
    expect(cleanSnippet('')).toBe(null);
  });

  it('keeps only trusted, kid-safe, readable results, no repeats, at most 4', () => {
    const json = {
      organic_results: [
        { title: 'NBL', link: 'https://www.nasa.gov/nbl', snippet: 'The Neutral Buoyancy Laboratory is a giant pool where astronauts practise spacewalks.' },
        { title: 'Spam', link: 'https://spam.example/x', snippet: 'Buy cheap stuff now, the best deals anywhere on the whole internet!' },
        { title: 'Another NASA page', link: 'https://www.nasa.gov/other', snippet: 'Another long enough snippet about astronauts training for space here.' },
        { title: 'ESA', link: 'https://www.esa.int/x', snippet: 'This snippet says a word kids should not see: shit happens in training.' },
        { title: 'No snippet', link: 'https://www.esa.int/y' },
        { title: 'A research paper', link: 'https://ntrs.nasa.gov/citations/1974', snippet: 'The use of a neutral buoyancy simulator for developing extravehicular activity systems.' },
        { title: 'A PDF', link: 'https://www.nasa.gov/files/report.pdf', snippet: 'A long technical PDF about training procedures and test results for engineers.' },
        { title: 'NBL again', link: 'https://www.nasa.gov/nbl/', snippet: 'The Neutral Buoyancy Laboratory is a giant pool where astronauts practise spacewalks.' },
      ],
    };
    const out = pickResults(json, '2026-11-15');
    expect(out).toEqual([
      {
        title: 'NBL',
        text: 'The Neutral Buoyancy Laboratory is a giant pool where astronauts practise spacewalks.',
        source: 'NASA',
        url: 'https://www.nasa.gov/nbl',
        foundOn: '2026-11-15',
      },
      {
        title: 'Another NASA page',
        text: 'Another long enough snippet about astronauts training for space here.',
        source: 'NASA',
        url: 'https://www.nasa.gov/other',
        foundOn: '2026-11-15',
      },
    ]);
  });

  it('always searches with strict SafeSearch, on one agency site, and only preset searches', () => {
    const url = new URL(serpUrl('nbl', 'KEY123'));
    expect(url.hostname).toBe('serpapi.com');
    expect(url.searchParams.get('safe')).toBe('1');
    expect(url.searchParams.get('q')).toMatch(/site:nasa\.gov$/);
    expect(url.searchParams.get('q')).toContain('Neutral Buoyancy');
    expect(url.searchParams.get('api_key')).toBe('KEY123');
    expect(() => serpUrl('anything a kid typed', 'KEY123')).toThrow();
  });

  it('refreshing a stage replaces only its old SerpApi rows, never the hand-picked links', () => {
    const saved = [
      { queryId: 'nbl', title: 'NBL fact sheet', via: undefined },
      { queryId: 'nbl', title: 'old search', via: 'SerpApi' },
      { queryId: 'zerog', title: 'zero-g search', via: 'SerpApi' },
    ];
    const fresh = [{ title: 'new', text: 'A new line long enough to keep for kids to read.', source: 'nasa.gov', url: 'https://www.nasa.gov/a', foundOn: '2026-11-15' }];
    const out = mergeRows(saved, 'nbl', fresh);
    expect(out.map((r) => r.title)).toEqual(['NBL fact sheet', 'zero-g search', 'new']);
    expect(out[2]).toMatchObject({ queryId: 'nbl', via: 'SerpApi', image: null });
  });

  it('keeps the old rows if a search comes back empty (never wipes good data)', () => {
    const saved = [{ queryId: 'nbl', title: 'old search', via: 'SerpApi' }];
    expect(mergeRows(saved, 'nbl', [])).toEqual(saved);
  });

  it('only keeps complete sentences: no cut-off endings, no page title glued on the front', () => {
    expect(cleanSnippet('Parabolic Flight Parabolic flights simulate space travel by giving short-term weightlessness.', 'Parabolic Flight')).toBe(
      'Parabolic flights simulate space travel by giving short-term weightlessness.',
    );
    expect(cleanSnippet('Astronauts train in a big pool. Two astronauts, attired in training…')).toBe(null); // first sentence too short alone
    expect(cleanSnippet('Astronauts practise spacewalks underwater in a giant pool in Houston. They wear full suits and work…')).toBe(
      'Astronauts practise spacewalks underwater in a giant pool in Houston.',
    );
    expect(cleanSnippet("Canadarm2's data sheet ... Text version Infographic indicating some organizations")).toBe(null);
    // real titles end with the site's name, but the snippet only repeats the first part
    expect(cleanSnippet('The history of Canadarm2 Canadarm2 made its debut on board the International Space Station (ISS) in 2001.', 'The history of Canadarm2 | Canadian Space Agency')).toBe(
      'Canadarm2 made its debut on board the International Space Station (ISS) in 2001.',
    );
  });

  it('skips lines that are not about astronauts or space, and names the agency', () => {
    const json = {
      organic_results: [
        { title: 'Math', link: 'https://www.nasa.gov/stem/q', snippet: 'Math and Science at Work presents a free-response question for advanced high school physics.' },
        { title: 'Arm', link: 'https://www.asc-csa.gc.ca/eng/iss/canadarm2/about.asp', snippet: "Canadarm2 is part of Canada's contribution to the International Space Station (ISS)." },
      ],
    };
    expect(pickResults(json, 'd').map((r) => r.source)).toEqual(['Canadian Space Agency']);
  });
});
