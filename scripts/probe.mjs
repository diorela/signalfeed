import { writeFile } from 'node:fs/promises';
const s = await (await fetch('https://diorela.github.io/signalfeed/data/stats.json?t=' + Date.now())).json();
await writeFile('probe.json', JSON.stringify({ gen: s.generatedAt, errors: s.errors, months: Object.keys(s.ransomware.months).length, complete: s.ransomware.complete, missing: s.ransomware.missing, kev: s.kev.items.length, kevUpdated: s.kev.updatedAt }));
