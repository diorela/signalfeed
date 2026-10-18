import { writeFile } from 'node:fs/promises';
const H = { 'User-Agent': 'Mozilla/5.0 (compatible; SignalFeed/1.0; personal news reader)', 'Accept': 'application/json,*/*' };
const get = async (u, n = 1500) => { try { const r = await fetch(u, { headers: H, signal: AbortSignal.timeout(60000) }); const t = await r.text(); return { status: r.status, bytes: t.length, head: t.slice(0, n) }; } catch (e) { return { error: String(e.message) }; } };
const out = {};
out.censusSectors = await get('https://api.census.gov/data/2022/cbp?get=NAICS2017,NAICS2017_LABEL,EMPSZES,ESTAB&for=us:*&EMPSZES=001', 6000);
out.censusSizes = await get('https://api.census.gov/data/2022/cbp?get=NAICS2017,EMPSZES,EMPSZES_LABEL,ESTAB&for=us:*&NAICS2017=62', 3000);
// Eurostat: inspect dimensions of the size-class dataset
try {
  const r = await fetch('https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/sbs_sc_ovw?format=JSON&lang=EN&geo=EU27_2020&geo=FR&time=2022', { headers: H, signal: AbortSignal.timeout(90000) });
  const j = await r.json();
  out.eurostat = { status: r.status, label: j.label, dims: Object.fromEntries(Object.entries(j.dimension || {}).map(([k, v]) => [k, Object.entries(v.category.label).slice(0, 80)])), n: Object.keys(j.value || {}).length };
} catch (e) { out.eurostat = { error: String(e.message) }; }
out.datagovsg = await get('https://api-production.data.gov.sg/v2/public/api/datasets?query=establishments%20industry', 4000);
out.datagovsg2 = await get('https://data.gov.sg/api/action/package_search?q=establishments', 3000);
out.zenodo = await get('https://zenodo.org/api/records/14965395', 4000);
out.eurepocApi = await get('https://eurepoc.eu/api/v1/incidents?limit=1', 800);
await writeFile('probe.json', JSON.stringify(out, null, 1));
