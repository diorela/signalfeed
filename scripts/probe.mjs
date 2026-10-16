import { writeFile } from 'node:fs/promises';
const s = await (await fetch('https://diorela.github.io/signalfeed/data/stats.json?t=' + Date.now())).json();
const o = {}; for (const x of s.kev.items.filter(x => x.d >= '2024-01-01' && x.p === 'Other')) { const k = x.v + ' | ' + x.n; o[k] = (o[k] || 0) + 1; }
const w = {}; for (const x of s.kev.items.filter(x => x.d >= '2024-01-01' && x.w === 'Other')) { const k = x.v + ' | ' + x.n + ' | ' + x.c; w[k] = 1; }
await writeFile('probe.json', JSON.stringify({ otherProducts: Object.entries(o).sort((a, b) => b[1] - a[1]), otherWeak: Object.keys(w).slice(0, 60), months: Object.keys(s.ransomware.months).length, complete: s.ransomware.complete }, null, 0));
