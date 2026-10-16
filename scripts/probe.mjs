import { writeFile } from 'node:fs/promises';
const s = await (await fetch('https://diorela.github.io/signalfeed/data/stats.json?t=' + Date.now())).json();
const rw = s.ransomware, months = Object.keys(rw.months).sort();
const yr = y => { const ms = months.filter(m => m.startsWith(y)); return { months: ms.length, v2: ms.filter(m => rw.months[m].v === 2).length, global: ms.reduce((n, m) => n + rw.months[m].global.n, 0), noCountry: ms.reduce((n, m) => n + (rw.months[m].global.noCountry || 0), 0), usa: ms.reduce((n, m) => n + (rw.months[m].usa?.n || 0), 0) }; };
await writeFile('probe.json', JSON.stringify({ gen: s.generatedAt, errors: s.errors, months: months.length, first: months[0], complete: rw.complete, y2023: yr('2023'), y2025: yr('2025'), y2026: yr('2026'), cov: Object.keys(s.coverage.weeks) }));
