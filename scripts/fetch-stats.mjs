// SignalFeed statistics: builds site/data/stats.json for the "Cyber Stats" section.
// Runs right after fetch-feeds.mjs. The two outside sources are refreshed about twice a day;
// in between, the previous numbers are reused so the page always has a stats file.
//
//  1. Ransomware victims named on leak sites, from ransomware.live (free API, no key).
//     Counted per day and per month for Global, Europe, USA, Singapore and China,
//     with the sectors and ransomware groups behind them.
//  2. Cyberattacks reported in the press, by country and attack type (ransomware.live).
//  3. How often SignalFeed's own cyber headlines mention each attack type, per week.
//  4. Number of organisations per sector (10+ employees) in the USA (Census Bureau) and the EU (Eurostat),
//     so the page can compare how often each sector is hit relative to its size.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';
import { execSync } from 'node:child_process';

const OUT_DIR = 'site/data';
const OUT = `${OUT_DIR}/stats.json`;
const USER_AGENT = 'Mozilla/5.0 (compatible; SignalFeed/1.0; personal news reader)';
const REFRESH_HOURS = 12;              // outside sources: refresh about twice a day
const RW_VERSION = 3;                  // bump when the monthly ransomware summary changes; months are re-read gradually
const ATTACKS_VERSION = 3;             // bump when the attack-type sorting changes
const FIRST_MONTH = '2022-01';         // ransomware history starts here
const BACKFILL_PER_RUN = 24;           // fetch at most this many old months per run (be polite)
const RECENT_MONTHS = 3;               // always re-read the current month and the 2 before it

const REGIONS = ['global', 'europe', 'usa', 'singapore', 'china'];
const EUROPE = new Set(('AL AD AT BA BE BG BY CH CY CZ DE DK EE ES FI FO FR GB GG GI GR HR HU IE IM IS IT JE ' +
  'LI LT LU LV MC MD ME MK MT NL NO PL PT RO RS SE SI SK SM UA UK VA XK').split(' '));
// Countries whose ransomware victims are also counted per sector (USA + EU-27), for the sector comparison.
const EU27 = new Set('AT BE BG CY CZ DE DK EE ES FI FR GR HR HU IE IT LT LU LV MT NL PL PT RO SE SI SK'.split(' '));
const regionOf = cc => {
  cc = String(cc || '').toUpperCase();
  if (cc === 'US') return 'usa';
  if (cc === 'SG') return 'singapore';
  if (cc === 'CN') return 'china';
  if (EUROPE.has(cc)) return 'europe';
  return null;
};

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function getJSON(url, timeout = 60000) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' }, signal: AbortSignal.timeout(timeout) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
async function loadPrevious() {
  const base = process.env.SITE_URL;
  if (!base) return {};
  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/data/stats.json?t=${Date.now()}`, { signal: AbortSignal.timeout(15000) });
    return res.ok ? await res.json() : {};
  } catch { return {}; }
}
const hoursSince = iso => iso ? (Date.now() - new Date(iso)) / 36e5 : Infinity;
const ymOf = d => d.toISOString().slice(0, 7);
function monthsBetween(from, to) {
  const out = []; let [y, m] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  while (y < ty || (y === ty && m <= tm)) { out.push(`${y}-${String(m).padStart(2, '0')}`); m++; if (m > 12) { m = 1; y++; } }
  return out;
}
const top = (counts, n) => Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, n));
const cleanLabel = s => {
  s = String(s || '').trim();
  return !s || /^(n\/?a|not found|unknown|none|-)$/i.test(s) ? 'Not stated' : s;
};

// ---------- 1. RANSOMWARE ----------
function summariseMonth(victims) {
  const regions = Object.fromEntries(REGIONS.map(r => [r, { n: 0, sectors: {}, groups: {} }]));
  regions.global.noCountry = 0;   // victims with no country recorded (they count only in Global)
  const daily = {}, cs = {};   // cs = victims per country per sector (USA + EU-27 only)
  for (const v of victims) {
    const when = new Date(v.discovered || v.published || v.attackdate);
    if (isNaN(when)) continue;
    const day = when.toISOString().slice(0, 10);
    const reg = regionOf(v.country);
    if (!String(v.country || '').trim()) regions.global.noCountry++;
    const sector = cleanLabel(v.activity);
    const group = cleanLabel(v.group || v.group_name);
    const cc = String(v.country || '').toUpperCase();
    if (cc === 'US' || EU27.has(cc)) { cs[cc] ||= {}; cs[cc][sector] = (cs[cc][sector] || 0) + 1; }
    daily[day] ||= Object.fromEntries(REGIONS.map(r => [r, 0]));
    for (const r of reg ? ['global', reg] : ['global']) {
      const R = regions[r];
      R.n++; R.sectors[sector] = (R.sectors[sector] || 0) + 1; R.groups[group] = (R.groups[group] || 0) + 1;
      daily[day][r]++;
    }
  }
  for (const r of REGIONS) { regions[r].sectors = top(regions[r].sectors, 20); regions[r].groups = top(regions[r].groups, 15); }
  return { regions, daily, cs };
}

async function updateRansomware(prev) {
  const months = { ...(prev.months || {}) };
  const daily = { ...(prev.daily || {}) };
  const all = monthsBetween(FIRST_MONTH, ymOf(new Date()));
  const recent = new Set(all.slice(-RECENT_MONTHS));
  const todo = [...all.filter(m => recent.has(m)), ...all.filter(m => !recent.has(m) && months[m]?.v !== RW_VERSION && !(months[m]?.failed && hoursSince(months[m].fetchedAt) < 24)).reverse().slice(0, BACKFILL_PER_RUN)];
  let fetched = 0, failed = 0;
  for (const ym of todo) {
    const [y, m] = ym.split('-');
    try {
      const list = await getJSON(`https://api.ransomware.live/v2/victims/${y}/${m}`);
      if (!Array.isArray(list)) throw new Error('unexpected reply');
      const s = summariseMonth(list);
      months[ym] = { ...s.regions, cs: s.cs, v: RW_VERSION, fetchedAt: new Date().toISOString() };
      for (const day of Object.keys(daily)) if (day.startsWith(ym)) delete daily[day];
      for (const [day, c] of Object.entries(s.daily)) if (day.startsWith(ym)) daily[day] = c;
      fetched++;
    } catch (e) {
      failed++; console.log(`ransomware.live ${ym}: ${e.message}`);
      if (!recent.has(ym) && !months[ym]?.global) months[ym] = { failed: true, v: RW_VERSION, fetchedAt: new Date().toISOString() };   // try again tomorrow
    }
    await sleep(1500);
  }
  console.log(`Ransomware: ${fetched} months read, ${failed} failed, ${Object.keys(months).length} months stored.`);
  if (!fetched && failed && !Object.keys(months).length) throw new Error('ransomware.live not reachable');
  return { source: 'ransomware.live', months, daily: Object.fromEntries(Object.entries(daily).sort()), updatedAt: new Date().toISOString(),
    complete: all.every(m => months[m]?.v === RW_VERSION), missing: all.filter(m => !months[m]?.global) };
}

// ---------- 1b. PUBLICLY REPORTED CYBERATTACKS ----------
// ransomware.live keeps a list of cyberattacks reported in the press (any kind, not only ransomware),
// with the victim's country. Summaries are often in French, so the type rules match English and French.
const ATTACK_TYPES = [
  ['Ransomware', /ransom|ran[cç]on|lockbit|akira|qilin|blackcat|play ransomware|encrypt|chiffr/i],
  // How the attackers got in, when the report says so (English, French, Italian, Spanish, German, Portuguese)
  ['Exploited vulnerability', /vulnerab|vuln[ée]rabilit|faille|falla de seguridad|vulnerabilit[àa]|schwachstelle|sicherheitsl[üu]cke|exploit|\bcve-\d|zero[- ]?day|0-day|unpatched|non corrig|patch(ed)? (flaw|bug)|security (flaw|hole|bug)|br[eè]che de s[ée]curit[ée]/i],
  ['DDoS & website takedowns', /ddos|d[ée]ni de service|denial[- ]of[- ]service|noname057|hacktivis|website.{0,30}(down|offline)|sites?.{0,40}inaccessible/i],
  ['Espionage & state-backed', /espionn|espionage|\bapt ?\d|state[- ]sponsored|[ée]tatique|nation[- ]state|chinese hackers|russian hackers|north korea|cor[ée]e du nord|salt typhoon|volt typhoon/i],
  ['Phishing & fraud', /phishing|hame[cç]onnage|fraud|scam|arnaque|business email|usurpation|social engineering|ing[ée]nierie sociale/i],
  ['Data theft & leaks', /fuite|leak|breach|exfiltr|vol de donn[ée]es|data theft|stolen data|donn[ée]es (personnelles|clients|sensibles)|dump|compromised data|acc[eè]s non autoris[ée]/i],
  ['Service disruption', /perturb|panne|outage|disrupt|indisponib|inaccessible|interrupt|hors service|paralys|shut down|offline|affect[ée]\w* (temporairement )?(les |ses )?(services|syst[eè]mes|op[ée]rations)|systems? (were |was )?(hit|affected)/i],
];
export const classifyAttack = a => {
  if (a.claim_gang) return 'Ransomware';           // claimed by a ransomware gang
  const text = `${a.title || ''} ${a.summary || ''} ${a.description || ''}`;
  return ATTACK_TYPES.find(([, re]) => re.test(text))?.[0] || 'Not specified';
};
async function updateAttacks() {
  const list = await getJSON('https://api.ransomware.live/v2/allcyberattacks', 120000);
  if (!Array.isArray(list)) throw new Error('unexpected reply');
  const items = [];
  for (const a of list) {
    const d = String(a.date || a.added || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || d < '2023-01-01') continue;
    const it = { d, cc: String(a.country || '').toUpperCase(), t: classifyAttack(a) };
    // victim, headline and link for every attack, so each bar on the page can list what happened
    it.v = String(a.victim || a.domain || '').slice(0, 70); it.h = String(a.title || '').slice(0, 140); it.u = /^https:\/\//i.test(a.url || '') ? a.url : '';
    items.push(it);
  }
  items.sort((a, b) => b.d.localeCompare(a.d));
  console.log(`Reported attacks: ${items.length} since 2023.`);
  return { source: 'ransomware.live (press-reported cyberattacks)', version: ATTACKS_VERSION, items, updatedAt: new Date().toISOString() };
}

// ---------- 4. ORGANISATIONS PER SECTOR (10+ employees) ----------
const ORGS_VERSION = 1, ORGS_REFRESH_DAYS = 30;   // official counts change once a year
const EU_NACE = ['C', 'D', 'E', 'F', 'G', 'G47', 'H', 'I', 'J', 'J61', 'J62', 'J63', 'K', 'K65', 'L', 'M', 'M69', 'N', 'P', 'Q', 'R'];
const US_NAICS = ['11----', '22----', '23----', '31----', '42----', '44----', '48----', '51----', '517///', '518///', '52----', '524///', '53----', '54----', '5411//', '5415//', '56----', '61----', '62----', '71----', '72----', '81----'];
async function eurostatCounts() {
  const geos = ['EU27_2020', ...[...EU27].map(c => c === 'GR' ? 'EL' : c)];
  for (const year of [new Date().getUTCFullYear() - 2, new Date().getUTCFullYear() - 3, new Date().getUTCFullYear() - 4]) {
    const q = [...geos.map(g => `geo=${g}`), ...EU_NACE.map(n => `nace_r2=${n}`), 'indic_sbs=ENT_NR', 'size_emp=TOTAL', 'size_emp=0-9', `time=${year}`].join('&');
    const j = await getJSON(`https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/sbs_sc_ovw?format=JSON&lang=EN&${q}`, 120000);
    const d = j.dimension, ids = j.id, size = j.size, val = j.value || {};
    if (!Object.keys(val).length) continue;
    const pos = (dim, code) => d[dim].category.index[code];
    const at = coords => { let idx = 0; for (let i = 0; i < ids.length; i++) idx = idx * size[i] + coords[ids[i]]; return val[idx]; };
    const out = {};
    for (const g of geos) for (const n of EU_NACE) {
      const base = { freq: 0, indic_sbs: pos('indic_sbs', 'ENT_NR'), nace_r2: pos('nace_r2', n), geo: pos('geo', g), time: 0 };
      if (base.nace_r2 == null || base.geo == null) continue;
      const tot = at({ ...base, size_emp: pos('size_emp', 'TOTAL') }), small = at({ ...base, size_emp: pos('size_emp', '0-9') });
      if (tot == null || small == null) continue;
      const geo = g === 'EU27_2020' ? 'EU27' : g === 'EL' ? 'GR' : g;
      (out[geo] ||= {})[n] = Math.max(0, Math.round(tot - small));
    }
    if (Object.keys(out).length) return { year, counts: out };
  }
  throw new Error('no Eurostat data');
}
function censusCounts() {
  // County Business Patterns, national file: establishments by industry and employee size class. No key needed.
  for (const yy of [new Date().getUTCFullYear() - 3, new Date().getUTCFullYear() - 4, new Date().getUTCFullYear() - 5]) {
    const y2 = String(yy).slice(2);
    try {
      execSync(`curl -sSfL -o /tmp/cbp.zip https://www2.census.gov/programs-surveys/cbp/datasets/${yy}/cbp${y2}us.zip && rm -rf /tmp/cbp && unzip -o -q /tmp/cbp.zip -d /tmp/cbp`, { stdio: 'ignore', timeout: 120000 });
      const file = execSync('ls /tmp/cbp/*.txt').toString().trim().split('\n')[0];
      const lines = execSync(`cat "${file}"`, { maxBuffer: 64 * 1024 * 1024 }).toString().split('\n');
      const head = lines[0].split(',').map(h => h.replace(/"/g, ''));
      const col = n => head.indexOf(n), iN = col('naics'), iL = col('lfo'), iE = col('est'), i5 = col('n<5'), i9 = col('n5_9');
      const want = new Set(US_NAICS), out = {};
      for (const line of lines.slice(1)) {
        const c = line.split(',').map(x => x.replace(/"/g, ''));
        if (c[iL] !== '-' || !want.has(c[iN])) continue;
        out[c[iN]] = Math.max(0, +c[iE] - +c[i5] - +c[i9]);
      }
      if (Object.keys(out).length > 5) return { year: yy, counts: out };
    } catch (e) { console.log(`Census ${yy}: ${String(e.message).slice(0, 100)}`); }
  }
  throw new Error('no Census data');
}
async function updateOrgs(prev) {
  const out = { version: ORGS_VERSION, eu: prev.eu || null, us: prev.us || null, updatedAt: new Date().toISOString() };
  try { out.eu = await eurostatCounts(); console.log(`Eurostat: ${out.eu.year}, ${Object.keys(out.eu.counts).length} areas.`); } catch (e) { console.log('Eurostat failed:', e.message); }
  try { out.us = censusCounts(); console.log(`Census: ${out.us.year}, ${Object.keys(out.us.counts).length} sectors.`); } catch (e) { console.log('Census failed:', e.message); }
  if (!out.eu && !out.us) throw new Error('no organisation counts');
  return out;
}

// ---------- 3. NEWS COVERAGE BY ATTACK TYPE ----------
const COVERAGE_TOPICS = ['phishing', 'ransomware', 'ai', 'supply', 'nation', 'exploited', 'vulns', 'impact', 'infra'];
const mondayOf = date => { const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
async function updateCoverage(prev) {
  const weeks = { ...(prev.weeks || {}) };
  const sandbox = {}; vm.createContext(sandbox);
  vm.runInContext(await readFile('site/filters.js', 'utf8'), sandbox);
  const SF = sandbox.SF;
  const { items = [] } = JSON.parse(await readFile(`${OUT_DIR}/headlines.json`, 'utf8'));
  // Headlines are kept 21 days, so only the last two full weeks plus this week are complete; older weeks stay as recorded.
  const cutoff = mondayOf(new Date(Date.now() - 14 * 864e5));
  const fresh = {};
  for (const it of items) {
    if (it.category !== 'cyber') continue;
    const wk = mondayOf(new Date(it.date));
    if (wk < cutoff && weeks[wk]) continue;
    const topics = SF.classify(it).topics;
    fresh[wk] ||= Object.fromEntries([['total', 0], ...COVERAGE_TOPICS.map(t => [t, 0])]);
    fresh[wk].total++;
    for (const t of topics) if (t in fresh[wk]) fresh[wk][t]++;
  }
  Object.assign(weeks, fresh);
  return { topics: COVERAGE_TOPICS, weeks: Object.fromEntries(Object.entries(weeks).sort()), since: prev.since || Object.keys(weeks).sort()[0] || mondayOf(new Date()) };
}

// ---------- MAIN ----------
async function main() {
  const prev = await loadPrevious();
  const out = { generatedAt: new Date().toISOString(), ransomware: prev.ransomware || null, attacks: prev.attacks || null, orgs: prev.orgs || null, coverage: prev.coverage || null, errors: {} };

  const rwDue = hoursSince(prev.ransomware?.updatedAt) >= REFRESH_HOURS || !prev.ransomware?.complete || Object.values(prev.ransomware?.months || {}).some(m => m.v !== RW_VERSION);
  if (rwDue) {
    try { out.ransomware = await updateRansomware(prev.ransomware || {}); }
    catch (e) { out.errors.ransomware = String(e.message || e); console.log('Ransomware failed:', e.message); }
  }
  if (hoursSince(prev.attacks?.updatedAt) >= REFRESH_HOURS || prev.attacks?.version !== ATTACKS_VERSION) {
    try { out.attacks = await updateAttacks(); }
    catch (e) { out.errors.attacks = String(e.message || e); console.log('Attacks failed:', e.message); }
  }
  if (hoursSince(prev.orgs?.updatedAt) >= ORGS_REFRESH_DAYS * 24 || prev.orgs?.version !== ORGS_VERSION || !prev.orgs?.eu || !prev.orgs?.us) {
    try { out.orgs = await updateOrgs(prev.orgs || {}); }
    catch (e) { out.errors.orgs = String(e.message || e); console.log('Organisation counts failed:', e.message); }
  }
  try { out.coverage = await updateCoverage(prev.coverage || {}); }
  catch (e) { out.errors.coverage = String(e.message || e); console.log('Coverage failed:', e.message); }

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT, JSON.stringify(out));
  console.log(`Wrote ${OUT}.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main().catch(async e => {
  // Never break the news update: fall back to whatever we had before.
  console.log('Stats failed:', e.message);
  try { await mkdir(OUT_DIR, { recursive: true }); await writeFile(OUT, JSON.stringify(await loadPrevious())); } catch {}
});
