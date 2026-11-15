import { describe, it, expect, vi } from 'vitest';
import { createWeb } from '../../data/index.js';
import webCache from '../../data/web_cache.json';

describe('Odysseus Real World Window (game.web.window("zerog"))', () => {
  it('shows a card about the real zero-G plane with its saved NASA links', async () => {
    const ui = { card: vi.fn(async () => 'ok') };
    await createWeb(ui).window('zerog');
    const card = ui.card.mock.calls[0][0];
    expect(card.title).toMatch(/zero-G plane/i);
    expect(card.links.length).toBeGreaterThanOrEqual(2);
    for (const link of card.links) {
      expect(link.url).toMatch(/^https:\/\/([a-z-]+\.)*nasa\.gov\//); // www., science., spinoff. ...
      expect(link.foundOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('every saved zero-G row follows the web_cache.json contract', () => {
    const rows = webCache.filter((r) => r.queryId === 'zerog');
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      for (const key of ['queryId', 'foundOn', 'title', 'source', 'url', 'image']) expect(row).toHaveProperty(key);
    }
  });
});
