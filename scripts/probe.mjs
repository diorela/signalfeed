import { writeFile } from 'node:fs/promises';
const s = await (await fetch('https://diorela.github.io/signalfeed/data/stats.json?t=' + Date.now())).json();
const rw = s.ransomware, months = Object.keys(rw.months).sort();
const yr = y => ['global','europe','usa','singapore','china'].map(r => months.filter(m => m.startsWith(y)).reduce((n, m) => n + (rw.months[m][r]?.n || 0), 0));
const p = {}; for (const x of s.kev.items.filter(x => x.d >= '2026-01-01')) p[x.p] = (p[x.p] || 0) + 1;
await writeFile('probe.json', JSON.stringify({ gen: s.generatedAt, errors: s.errors, months: months.length, first: months[0], complete: rw.complete, years: { 2022: yr('2022'), 2023: yr('2023'), 2024: yr('2024'), 2025: yr('2025'), 2026: yr('2026') }, kevVersion: s.kev.version, kev2026: p }));
