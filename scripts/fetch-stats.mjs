// SignalFeed statistics: builds site/data/stats.json for the "Cyber Stats" section.
// Runs right after fetch-feeds.mjs. The two outside sources are refreshed about twice a day;
// in between, the previous numbers are reused so the page always has a stats file.
//
//  1. Ransomware victims named on leak sites, from ransomware.live (free API, no key).
//     Counted per day and per month for Global, Europe, USA, Singapore and China,
//     with the sectors and ransomware groups behind them.
//  2. Exploited vulnerabilities from CISA's Known Exploited Vulnerabilities catalogue.
//  3. How often SignalFeed's own cyber headlines mention each attack type, per week.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';

const OUT_DIR = 'site/data';
const OUT = `${OUT_DIR}/stats.json`;
const USER_AGENT = 'Mozilla/5.0 (compatible; SignalFeed/1.0; personal news reader)';
const REFRESH_HOURS = 12;              // outside sources: refresh about twice a day
const KEV_VERSION = 2;
const RW_VERSION = 2;                  // bump when the monthly ransomware summary changes; months are re-read gradually                 // bump when the product/weakness sorting changes, to re-sort right away
const FIRST_MONTH = '2022-01';         // ransomware history starts here
const BACKFILL_PER_RUN = 24;           // fetch at most this many old months per run (be polite)
const RECENT_MONTHS = 3;               // always re-read the current month and the 2 before it

const REGIONS = ['global', 'europe', 'usa', 'singapore', 'china'];
const EUROPE = new Set(('AL AD AT BA BE BG BY CH CY CZ DE DK EE ES FI FO FR GB GG GI GR HR HU IE IM IS IT JE ' +
  'LI LT LU LV MC MD ME MK MT NL NO PL PT RO RS SE SI SK SM UA UK VA XK').split(' '));
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
  const daily = {};
  for (const v of victims) {
    const when = new Date(v.discovered || v.published || v.attackdate);
    if (isNaN(when)) continue;
    const day = when.toISOString().slice(0, 10);
    const reg = regionOf(v.country);
    if (!String(v.country || '').trim()) regions.global.noCountry++;
    const sector = cleanLabel(v.activity);
    const group = cleanLabel(v.group || v.group_name);
    daily[day] ||= Object.fromEntries(REGIONS.map(r => [r, 0]));
    for (const r of reg ? ['global', reg] : ['global']) {
      const R = regions[r];
      R.n++; R.sectors[sector] = (R.sectors[sector] || 0) + 1; R.groups[group] = (R.groups[group] || 0) + 1;
      daily[day][r]++;
    }
  }
  for (const r of REGIONS) { regions[r].sectors = top(regions[r].sectors, 20); regions[r].groups = top(regions[r].groups, 15); }
  return { regions, daily };
}

async function updateRansomware(prev) {
  const months = { ...(prev.months || {}) };
  const daily = { ...(prev.daily || {}) };
  const all = monthsBetween(FIRST_MONTH, ymOf(new Date()));
  const recent = new Set(all.slice(-RECENT_MONTHS));
  const todo = [...all.filter(m => recent.has(m)), ...all.filter(m => !recent.has(m) && months[m]?.v !== RW_VERSION).reverse().slice(0, BACKFILL_PER_RUN)];
  let fetched = 0, failed = 0;
  for (const ym of todo) {
    const [y, m] = ym.split('-');
    try {
      const list = await getJSON(`https://api.ransomware.live/v2/victims/${y}/${m}`);
      if (!Array.isArray(list)) throw new Error('unexpected reply');
      const s = summariseMonth(list);
      months[ym] = { ...s.regions, v: RW_VERSION, fetchedAt: new Date().toISOString() };
      for (const day of Object.keys(daily)) if (day.startsWith(ym)) delete daily[day];
      for (const [day, c] of Object.entries(s.daily)) if (day.startsWith(ym)) daily[day] = c;
      fetched++;
    } catch (e) { failed++; console.log(`ransomware.live ${ym}: ${e.message}`); }
    await sleep(1500);
  }
  console.log(`Ransomware: ${fetched} months read, ${failed} failed, ${Object.keys(months).length} months stored.`);
  if (!fetched && failed) throw new Error('ransomware.live not reachable');
  return { source: 'ransomware.live', months, daily: Object.fromEntries(Object.entries(daily).sort()), updatedAt: new Date().toISOString(),
    complete: all.every(m => months[m]?.v === RW_VERSION) };
}

// ---------- 2. EXPLOITED VULNERABILITIES (CISA KEV) ----------
const PRODUCT_TYPES = [   // first match wins, so the more specific groups come first
  ['AI & developer tools', /langflow|litellm|mlflow|ray-project|marimo|\bn8n\b|jfrog|artifactory|teamcity|jenkins|gitlab|gitea|gogs|\bgit\b|github action|nx console|tanstack|\bvite|prettier|eslint|react native|trivy|kestra|ollama|openai/i],
  ['Browsers', /chrome|chromium|firefox|mozilla|webkit|safari|internet explorer|flash player|\bskia\b|google \| dawn|\bdawn\b/i],
  ['Network & edge devices', /cisco|fortinet|fortios|fortigate|fortiweb|ivanti|pulse secure|palo alto|pan-os|citrix|netscaler|sonicwall|juniper|\bf5\b|big-ip|zyxel|d-link|tp-link|netgear|check point|sophos|array networks|draytek|mikrotik|ubiquiti|barracuda|watchguard|versa|aruba|arista|brocade|aviatrix|velocloud|dd-wrt|sierra wireless|aleos|lantronix|\bbind\b|proftpd|nhttpd|nostromo|router|firewall|vpn/i],
  ['IT management, backup & file transfer', /simplehelp|n-able|n-central|beyondtrust|connectwise|screenconnect|sysaid|\bkace\b|prtg|configuration manager|workspace one|omnissa|lanscope|skysea|papercut|commvault|nakivo|acronis|veeam|\bcleo\b|goanywhere|gladinet|centrestack|triofox|filezen|proself|moveit|crushftp|ahsay|recoverpoint|oneview|splunk|sciencelogic|servicenow|trend micro|apex one|defender|threatsonar|kaseya|solarwinds/i],
  ['Web apps, CMS & email', /roundcube|craft cms|kentico|sitecore|joomla|wordpress|drupal|magento|commerce|laravel|livewire|\brails\b|\byii\b|strapi|xwiki|projectsend|adminer|cyberpanel|control web panel|cpanel|smartermail|zimbra|owncloud|metabase|grafana|zammad|jquery|ajax\.net|output messenger|active! mail|mirth|cityworks|usaherds|veracore|apriso|windchill|\bqlik\b|power pages|partner center|starlette|erlang|\bphp\b|struts|log4j|tomcat|apache|weblogic|coldfusion|experience manager|sharepoint|exchange|confluence|jira|atlassian|webmail/i],
  ['Office, documents & apps', /\boffice\b|\bword\b|excel|outlook|powerpoint|publisher|microsoft \| project|visual basic|acrobat|reader|winrar|7-zip|whatsapp|authy|notepad\+\+|daemon tools|telemessage|trueconf|imagemagick|freetype|jai-ext/i],
  ['Operating systems & phones', /windows|win32k|kernel|\bios\b|ipados|macos|android|pixel|samsung|qualcomm|chipset|\bmali\b|\bdwm\b|smartscreen|directx|\.net framework|streaming service|active directory|\bsudo\b|\bbash\b|inetutils|libuser|bug reporting|red hat|igel|apple/i],
  ['IoT, cameras & industrial', /hikvision|dahua|qnap|synology|siemens|schneider|rockwell|camera|\bnas\b|\bdvr\b|scada|\bplc\b|\biot\b|geovision|nuuo|digiever|\bknx\b|meteobridge|megarac|linear emerge|mitel|sangoma|freepbx|switchvox|audinate|dante|sunhillo/i],
  ['Virtualisation & enterprise software', /vmware|vcenter|esxi|oracle|\bsap\b|progress|kubernetes|docker|salesforce|\bibm\b|\bhpe\b|\bdell\b|wso2|server|microsoft/i],
];
const WEAKNESS_TYPES = [
  ['Code & command injection', /CWE-(77|78|94|95|74|917|1336|502|20)\b/, /command injection|code injection|deserializ|remote code/i],
  ['Memory corruption', /CWE-(787|416|125|119|120|121|122|190|476|843|415|704|822|824)\b/, /use-after-free|out-of-bounds|buffer overflow|memory corruption|type confusion|heap/i],
  ['Login & access bypass', /CWE-(287|288|290|306|862|863|284|285|269|639|798|640|294|1390|266|250)\b/, /authentication bypass|missing authentication|improper authentication|privilege escalation|access control|hard-coded|authorization/i],
  ['Files: path traversal & upload', /CWE-(22|23|35|552|434|73|59)\b/, /path traversal|directory traversal|file upload|arbitrary file/i],
  ['Web attacks (XSS, SSRF, CSRF, SQL)', /CWE-(79|918|352|601|89)\b/, /cross-site|server-side request|sql injection|open redirect/i],
];
export const classifyKev = v => {
  const prod = `${v.vendorProject} | ${v.product}`;
  const p = PRODUCT_TYPES.find(([, re]) => re.test(prod))?.[0] || 'Other';
  const cwes = (v.cwes || []).join(' ');
  const text = `${v.vulnerabilityName} ${v.shortDescription}`;
  const w = WEAKNESS_TYPES.find(([, cwe]) => cwe.test(cwes))?.[0] || WEAKNESS_TYPES.find(([, , kw]) => kw.test(text))?.[0] || 'Other';
  return { p, w };
};
async function updateKev() {
  let data;
  try { data = await getJSON('https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json'); }
  catch { data = await getJSON('https://raw.githubusercontent.com/cisagov/kev-data/develop/known_exploited_vulnerabilities.json'); }
  const list = (data.vulnerabilities || []).map(v => {
    const { p, w } = classifyKev(v);
    return { d: v.dateAdded, c: v.cveID, v: v.vendorProject, n: v.product, p, w, r: /^known$/i.test(String(v.knownRansomwareCampaignUse || '').trim()) ? 1 : 0 };
  }).filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x.d)).sort((a, b) => b.d.localeCompare(a.d));
  console.log(`CISA KEV: ${list.length} entries.`);
  return { source: 'CISA KEV', version: KEV_VERSION, items: list, updatedAt: new Date().toISOString() };
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
  const out = { generatedAt: new Date().toISOString(), ransomware: prev.ransomware || null, kev: prev.kev || null, coverage: prev.coverage || null, errors: {} };

  const rwDue = hoursSince(prev.ransomware?.updatedAt) >= REFRESH_HOURS || !prev.ransomware?.complete;
  if (rwDue) {
    try { out.ransomware = await updateRansomware(prev.ransomware || {}); }
    catch (e) { out.errors.ransomware = String(e.message || e); console.log('Ransomware failed:', e.message); }
  }
  if (hoursSince(prev.kev?.updatedAt) >= REFRESH_HOURS || prev.kev?.version !== KEV_VERSION) {
    try { out.kev = await updateKev(); }
    catch (e) { out.errors.kev = String(e.message || e); console.log('KEV failed:', e.message); }
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
