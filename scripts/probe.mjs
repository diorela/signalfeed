import { writeFile } from 'node:fs/promises';
const h = await (await fetch('https://diorela.github.io/signalfeed/data/headlines.json?t=' + Date.now())).json();
const by = {}; for (const i of h.items) if (/Le Monde|Repubblica/.test(i.source)) (by[i.source] ||= []).push([i.date, i.title]);
await writeFile('probe.json', JSON.stringify({ health: h.sources.filter(s => /Le Monde|Repubblica/.test(s.name)), counts: Object.fromEntries(Object.entries(by).map(([k, v]) => [k, v.length])), sample: Object.fromEntries(Object.entries(by).map(([k, v]) => [k, v.slice(0, 2)])) }, null, 1));
