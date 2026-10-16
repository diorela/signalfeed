import { writeFile } from 'node:fs/promises';
const C = {
  'rl v2 recent': 'https://api.ransomware.live/v2/recentvictims',
  'rl v2 month': 'https://api.ransomware.live/v2/victims/2026/09',
  'rl v2 country SG': 'https://api.ransomware.live/v2/countryvictims/SG',
  'rl v2 info': 'https://api.ransomware.live/v2/info',
  'rl v2 sectors': 'https://api.ransomware.live/v2/sectorvictims/Healthcare',
  'rl v1 month': 'https://api.ransomware.live/victims/2026/09',
  'rl v2 allcyberattacks': 'https://api.ransomware.live/v2/allcyberattacks',
  'rl data repo': 'https://raw.githubusercontent.com/JMousqueton/ransomware.live/main/db/victims.json',
  'ransomwatch posts': 'https://raw.githubusercontent.com/joshhighet/ransomwatch/main/posts.json',
  'cisa kev': 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json',
  'cisa kev gh mirror': 'https://raw.githubusercontent.com/cisagov/kev-data/develop/known_exploited_vulnerabilities.json',
  'oecd aim': 'https://oecd.ai/api/incidents?page=1',
  'cf radar noauth': 'https://api.cloudflare.com/client/v4/radar/attacks/layer3/summary/protocol',
};
const out = {};
await Promise.all(Object.entries(C).map(async ([name, url]) => {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SignalFeed/1.0; personal news reader)', 'Accept': 'application/json,*/*' }, signal: AbortSignal.timeout(60000) });
    const txt = await r.text();
    let info = { status: r.status, bytes: txt.length, head: txt.slice(0, 300) };
    try { const j = JSON.parse(txt); const arr = Array.isArray(j) ? j : (j.vulnerabilities || j.victims || j.data || null);
      info.type = Array.isArray(j) ? 'array' : 'object'; info.keys = Array.isArray(j) ? null : Object.keys(j).slice(0, 15);
      if (Array.isArray(arr)) { info.count = arr.length; info.sample = arr.slice(0, 2); info.last = arr.slice(-1); } } catch {}
    out[name] = info;
  } catch (e) { out[name] = { error: String(e.message || e) }; }
}));
await writeFile('probe.json', JSON.stringify(out, null, 1));
