import { writeFile } from 'node:fs/promises';
const s = await (await fetch('https://diorela.github.io/signalfeed/data/stats.json?t=' + Date.now())).json();
const A = s.attacks?.items || [];
const EU = new Set('AL AD AT BA BE BG BY CH CY CZ DE DK EE ES FI FO FR GB GG GI GR HR HU IE IM IS IT JE LI LT LU LV MC MD ME MK MT NL NO PL PT RO RS SE SI SK SM UA UK VA XK'.split(' '));
const reg = cc => cc === 'US' ? 'usa' : cc === 'SG' ? 'sg' : cc === 'CN' ? 'cn' : EU.has(cc) ? 'eu' : 'other';
const y = {}; for (const x of A) { const k = x.d.slice(0, 4) + ' ' + reg(x.cc); y[k] = (y[k] || 0) + 1; }
const t = {}; for (const x of A.filter(x => x.d >= '2026-01-01')) t[x.t] = (t[x.t] || 0) + 1;
await writeFile('probe.json', JSON.stringify({ errors: s.errors, n: A.length, years: y, types2026: t, sample: A.filter(x => x.h).slice(0, 12).map(x => [x.d, x.cc, x.t, x.h]) }, null, 1));
