import fs from 'node:fs';
const s = await (await fetch('https://diorela.github.io/signalfeed/data/stats.json?' + Date.now())).json();
const html = await (await fetch('https://diorela.github.io/signalfeed/?' + Date.now())).text();
const m = s.ransomware?.months || {};
const types = {}; for (const a of s.attacks?.items || []) types[a.t] = (types[a.t] || 0) + 1;
fs.writeFileSync('probe.json', JSON.stringify({ errors: s.errors, kev: !!s.kev, orgs: s.orgs && { eu: s.orgs.eu?.year, euAreas: Object.keys(s.orgs.eu?.counts || {}).length, us: s.orgs.us?.year, usN: Object.keys(s.orgs.us?.counts || {}).length }, monthsWithCs: Object.values(m).filter(x => x.cs).length, months: Object.keys(m).length, types, page: { sector: html.includes('sectorCard'), kev: html.includes('Exploited flaws (CISA)') } }, null, 1));
