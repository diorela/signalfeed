import { writeFile } from 'node:fs/promises';
const r = await fetch('https://diorela.github.io/signalfeed/data/stats.json?t=' + Date.now());
const s = await r.json();
const rw = s.ransomware || {};
const months = Object.keys(rw.months || {}).sort();
const out = { status: r.status, generatedAt: s.generatedAt, errors: s.errors, rwMonths: months.length, first: months[0], last: months.at(-1), complete: rw.complete,
  lastMonths: months.slice(-4).map(m => [m, ...['global','europe','usa','singapore','china'].map(k => rw.months[m][k]?.n)]),
  topSectorsGlobal: rw.months?.[months.at(-2)]?.global?.sectors, topGroups: rw.months?.[months.at(-2)]?.global?.groups,
  kevCount: s.kev?.items?.length, kevLatest: s.kev?.items?.slice(0, 5), kevTypes: Object.entries((s.kev?.items || []).filter(x => x.d >= '2026-01-01').reduce((o, x) => (o[x.p] = (o[x.p] || 0) + 1, o), {})),
  kevWeak: Object.entries((s.kev?.items || []).filter(x => x.d >= '2026-01-01').reduce((o, x) => (o[x.w] = (o[x.w] || 0) + 1, o), {})),
  coverage: s.coverage, sizeKB: Math.round(JSON.stringify(s).length / 1024) };
await writeFile('probe.json', JSON.stringify(out, null, 1));
