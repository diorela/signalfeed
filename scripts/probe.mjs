import { writeFile } from 'node:fs/promises';
const r = await fetch('https://diorela.github.io/signalfeed/data/stats.json?t=' + Date.now()); const txt = await r.text(); const s = JSON.parse(txt);
const A = s.attacks.items;
await writeFile('probe.json', JSON.stringify({ sizeKB: Math.round(txt.length / 1024), version: s.attacks.version, n: A.length, withHeadline: A.filter(x => x.h).length, oct17: A.filter(x => x.d >= '2026-10-12').map(x => [x.d, x.cc, x.t, x.v, x.h]) }, null, 1));
