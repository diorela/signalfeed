import { writeFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';
const H = { 'User-Agent': 'Mozilla/5.0 (compatible; SignalFeed/1.0; personal news reader)', 'Accept': 'application/json,*/*' };
const out = {};
try {
  const u = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/sbs_sc_ovw?format=JSON&lang=EN&geo=EU27_2020&indic_sbs=ENT_NR&time=2022&size_emp=TOTAL&size_emp=0-9';
  const j = await (await fetch(u, { headers: H, signal: AbortSignal.timeout(90000) })).json();
  const nace = j.dimension.nace_r2.category, size = j.dimension.size_emp.category;
  const ni = nace.index, si = size.index, nS = Object.keys(si).length;
  const sec = Object.keys(ni).filter(k => /^[A-Z]$|^[A-Z]-[A-Z]$|^[A-Z]\d\d$/.test(k) && k.length <= 3 && !/\d/.test(k) || /^(J62|J63|K64|K65|K66|M69|M70|M71|M72|M73|M74|M75)$/.test(k));
  out.eu = sec.map(k => [k, nace.label[k].slice(0, 45), ...Object.keys(si).map(s => j.value[ni[k] * nS + si[s]] ?? null)]);
  out.euSizes = Object.keys(si);
} catch (e) { out.eu = String(e.message); }
try {
  execSync('curl -sSL -o /tmp/cbp.zip https://www2.census.gov/programs-surveys/cbp/datasets/2022/cbp22us.zip && unzip -o -q /tmp/cbp.zip -d /tmp/cbp && ls -la /tmp/cbp');
  out.cbpFiles = execSync('ls /tmp/cbp').toString();
  const f = execSync('ls /tmp/cbp | head -1').toString().trim();
  const txt = execSync(`head -3 /tmp/cbp/${f}; grep -E '^\"?(US|us)?' /tmp/cbp/${f} | grep -E ',\"?(62|54|31-33|61|52|92)\"?,' | head -12`).toString();
  out.cbpHead = txt.slice(0, 3000);
} catch (e) { out.cbp = String(e.message).slice(0, 500); }
const sg = await (await fetch('https://api-production.data.gov.sg/v2/public/api/datasets?query=enterprises%20by%20industry', { headers: H })).json().catch(e => ({ err: String(e) }));
out.sg = (sg.data?.datasets || []).slice(0, 15).map(d => [d.datasetId, d.name]);
const sg2 = await (await fetch('https://api-production.data.gov.sg/v2/public/api/datasets?query=establishments', { headers: H })).json().catch(e => ({ err: String(e) }));
out.sg2 = (sg2.data?.datasets || []).slice(0, 15).map(d => [d.datasetId, d.name]);
await writeFile('probe.json', JSON.stringify(out, null, 1));
