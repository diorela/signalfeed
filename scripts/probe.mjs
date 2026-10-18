import { execSync } from 'node:child_process';
import fs from 'node:fs';
let log = '';
try { log = execSync('node scripts/fetch-stats.mjs 2>&1', { maxBuffer: 1e8, timeout: 900000 }).toString(); } catch (e) { log = String(e.stdout || '') + String(e.message); }
const s = JSON.parse(fs.readFileSync('site/data/stats.json', 'utf8'));
const months = s.ransomware?.months || {};
const withCs = Object.entries(months).filter(([, m]) => m.cs).map(([k]) => k);
const last = withCs.sort().slice(-1)[0];
const types = {}; for (const a of s.attacks?.items || []) types[a.t] = (types[a.t] || 0) + 1;
fs.writeFileSync('probe.json', JSON.stringify({ log: log.slice(-4000), errors: s.errors, orgs: s.orgs, withCs, sampleCs: last && { US: months[last].cs.US, DE: months[last].cs.DE }, types, ev: (s.attacks?.items || []).filter(a => a.t === 'Exploited vulnerability').slice(0, 8).map(a => a.h) }, null, 1));
