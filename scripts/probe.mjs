import { writeFile } from 'node:fs/promises';
const H = { 'User-Agent': 'Mozilla/5.0 (compatible; SignalFeed/1.0; personal news reader)', 'Accept': 'application/json' };
const a = await (await fetch('https://api.ransomware.live/v2/allcyberattacks', { headers: H })).json();
const keys = {}; for (const x of a) for (const k of Object.keys(x)) keys[k] = (keys[k] || 0) + 1;
const byYear = {}, byCountry = {}, byGang = {};
for (const x of a) { const y = String(x.date || x.added).slice(0, 4); byYear[y] = (byYear[y] || 0) + 1; byCountry[x.country || '?'] = (byCountry[x.country || '?'] || 0) + 1; byGang[x.claim_gang ? 'has gang' : 'no gang'] = (byGang[x.claim_gang ? 'has gang' : 'no gang'] || 0) + 1; }
const recent = a.filter(x => String(x.date) >= '2026-09-01').slice(0, 8).map(x => ({ date: x.date, country: x.country, gang: x.claim_gang, title: x.title, summary: String(x.summary || x.description || '').slice(0, 220), url: x.url }));
// other candidate datasets
const tryUrl = async u => { try { const r = await fetch(u, { headers: H, signal: AbortSignal.timeout(30000) }); const t = await r.text(); return { status: r.status, bytes: t.length, head: t.slice(0, 300) }; } catch (e) { return { error: String(e.message) }; } };
const others = {
  eurepoc: await tryUrl('https://eurepoc.eu/database/'),
  hackmageddon: await tryUrl('https://www.hackmageddon.com/feed/'),
  rl_v2_press: await tryUrl('https://api.ransomware.live/v2/press/recent'),
};
await writeFile('probe.json', JSON.stringify({ total: a.length, keys, byYear, topCountries: Object.entries(byCountry).sort((x, y) => y[1] - x[1]).slice(0, 15), byGang, recent, others }, null, 1));
