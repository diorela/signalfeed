import { parseFeed } from './fetch-feeds.mjs';
import { writeFile } from 'node:fs/promises';
const C = { 'LM en_continu': 'https://www.lemonde.fr/rss/en_continu.xml', 'LM une': 'https://www.lemonde.fr/rss/une.xml', 'LR homepage': 'https://www.repubblica.it/rss/homepage/rss2.0.xml', 'LR ultimora': 'https://www.repubblica.it/rss/ultimora/rss2.0.xml' };
const out = {};
for (const [name, url] of Object.entries(C)) {
  try { const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SignalFeed/1.0; personal news reader)' }, signal: AbortSignal.timeout(20000) });
    const items = parseFeed(await r.text()); const secs = {};
    for (const i of items) { const m = i.link.match(/\.(?:fr|it)\/(?:en\/)?([a-z-]+)\//); const k = m ? m[1] : '?'; secs[k] = (secs[k] || 0) + 1; }
    out[name] = { status: r.status, count: items.length, sections: secs, oldestH: items.length ? +((Date.now() - Math.min(...items.map(i => +new Date(i.date)))) / 36e5).toFixed(1) : null };
  } catch (e) { out[name] = { error: String(e.message) }; }
}
await writeFile('probe.json', JSON.stringify(out, null, 1));
