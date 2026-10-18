import { writeFile } from 'node:fs/promises';
const h = await (await fetch('https://diorela.github.io/signalfeed/data/headlines.json?t=' + Date.now())).json();
const c = {}; for (const i of h.items) { const k = i.category + ' · ' + i.source; c[k] = (c[k] || 0) + 1; }
await writeFile('probe.json', JSON.stringify(Object.fromEntries(Object.entries(c).filter(([k]) => /eu|Le Monde|Repubblica/.test(k)))));
