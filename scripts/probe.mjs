import { parseFeed } from './fetch-feeds.mjs';
import { writeFile } from 'node:fs/promises';
const C = {
  'Le Monde FR international': 'https://www.lemonde.fr/international/rss_full.xml',
  'Le Monde EN international': 'https://www.lemonde.fr/en/international/rss_full.xml',
  'Le Monde EN all': 'https://www.lemonde.fr/en/rss/une.xml',
  'Repubblica esteri': 'https://www.repubblica.it/rss/esteri/rss2.0.xml',
  'Repubblica homepage': 'https://www.repubblica.it/rss/homepage/rss2.0.xml',
};
const out = {};
await Promise.all(Object.entries(C).map(async ([name, url]) => {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SignalFeed/1.0; personal news reader)', 'Accept': 'application/rss+xml, application/xml, text/xml, */*' }, signal: AbortSignal.timeout(20000) });
    const items = parseFeed(await r.text());
    const dates = items.map(i => +new Date(i.date)).filter(Boolean);
    out[name] = { status: r.status, count: items.length, withDesc: items.filter(i => i.description).length, newestH: dates.length ? +((Date.now() - Math.max(...dates)) / 36e5).toFixed(1) : null, sample: items.slice(0, 4).map(i => [i.title, i.link, i.description.slice(0, 90), i.date]) };
  } catch (e) { out[name] = { error: String(e.message) }; }
}));
await writeFile('probe.json', JSON.stringify(out, null, 1));
