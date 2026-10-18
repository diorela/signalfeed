// SignalFeed relay: reads every source directly from the publisher and writes
// site/data/headlines.json for the page to display.
// Runs on GitHub Actions every 5 minutes. No dependencies (Node 20+).

import { mkdir, writeFile } from 'node:fs/promises';

// ---------- SOURCES ----------
// type: 'rss' = the site's own news feed, 'claroty' = read the research page,
// 'bleeping-home' = backup reading of BleepingComputer's "latest articles" list.
// IT-Connect: keep a story only if its TITLE is clearly about a threat or flaw
// (not admin guides or general Windows update notes that merely mention "security").
const SECURITY_TITLE = /\b(cve-|vulnerab|exploit|zero[- ]?days?\b|0-day|malware|ransomware|breach|hack|phish|cyberattack|attack|backdoor|botnet|trojan|spyware|stealer|rce\b|ddos|extort|leak|compromis|threat actor|apt\d|flaw)/i;

export const SOURCES = [
  // ---- Cybersecurity ----
  { name: 'The Hacker News',   category: 'cyber', type: 'rss', url: 'https://feeds.feedburner.com/TheHackersNews' },
  { name: 'BleepingComputer',  category: 'cyber', type: 'rss', url: 'https://www.bleepingcomputer.com/feed/',
    keep: it => !/\/offer\/deals\//.test(it.link) },
  { name: 'BleepingComputer',  category: 'cyber', type: 'bleeping-home', url: 'https://www.bleepingcomputer.com/', backup: true },
  { name: 'Dark Reading',      category: 'cyber', type: 'rss', url: 'https://www.darkreading.com/rss.xml' },
  { name: 'SecurityWeek',      category: 'cyber', type: 'rss', url: 'https://www.securityweek.com/feed/' },
  { name: 'Krebs on Security', category: 'cyber', type: 'rss', url: 'https://krebsonsecurity.com/feed/' },
  { name: 'SANS ISC',          category: 'cyber', type: 'rss', url: 'https://isc.sans.edu/rssfeed_full.xml',
    keep: it => !/^ISC Stormcast/i.test(it.title),                       // skip the daily podcast entries
    fix:  it => { it.link = it.link.replace('/diary/rss/', '/diary/'); } },
  { name: 'IT-Connect',        category: 'cyber', type: 'rss', url: 'https://www.it-connect.tech/feed/',
    keep: it => SECURITY_TITLE.test(it.title) },                          // security stories only, no how-to guides

  // ---- Geopolitics ----
  { name: 'BBC World',      category: 'geo', type: 'rss', url: 'https://feeds.bbci.co.uk/news/world/rss.xml',
    keep: it => !/\/(sport|sounds|iplayer|videos)\//.test(it.link) },
  { name: 'The Guardian',   category: 'geo', type: 'rss', url: 'https://www.theguardian.com/world/rss',
    keep: it => /theguardian\.com\/(world|global-development)\//.test(it.link) }, // world news only, no UK/Australian domestic stories
  { name: 'Al Jazeera',     category: 'geo', type: 'rss', url: 'https://www.aljazeera.com/xml/rss/all.xml',
    keep: it => /aljazeera\.com\/(news|features|opinions|economy)\//.test(it.link) }, // no sport, no video clips
  { name: 'Foreign Policy', category: 'geo', type: 'rss', url: 'https://foreignpolicy.com/feed/' },
  { name: 'France 24',      category: 'geo', type: 'rss', url: 'https://www.france24.com/en/monde/rss',
    keep: it => !/\/sport\//.test(it.link) },
  { name: 'Le Monde',       category: 'geo', type: 'rss', url: 'https://www.lemonde.fr/international/rss_full.xml' },   // in French
  { name: 'La Repubblica',  category: 'geo', type: 'rss', url: 'https://www.repubblica.it/rss/esteri/rss2.0.xml' },    // in Italian, world section

  // ---- Economy & Finance ----
  // FT and The Economist are paywalled: their feeds give the headline and a one-line summary, and the link opens their site.
  { name: 'Financial Times',   category: 'fin', type: 'rss', url: 'https://www.ft.com/global-economy?format=rss' },
  { name: 'Financial Times',   category: 'fin', type: 'rss', url: 'https://www.ft.com/markets?format=rss' },
  { name: 'The Economist',     category: 'fin', type: 'rss', url: 'https://www.economist.com/finance-and-economics/rss.xml' },
  { name: 'The Economist',     category: 'fin', type: 'rss', url: 'https://www.economist.com/business/rss.xml' },
  { name: 'BBC Business',      category: 'fin', type: 'rss', url: 'https://feeds.bbci.co.uk/news/business/rss.xml',
    keep: it => !/\/(sport|sounds|iplayer|videos)\//.test(it.link) },
  { name: 'Guardian Business', category: 'fin', type: 'rss', url: 'https://www.theguardian.com/business/economics/rss' },
  { name: 'Guardian Business', category: 'fin', type: 'rss', url: 'https://www.theguardian.com/business/rss' },
  { name: 'CNBC',              category: 'fin', type: 'rss', url: 'https://www.cnbc.com/id/20910258/device/rss/rss.html' },
  { name: 'CNBC',              category: 'fin', type: 'rss', url: 'https://www.cnbc.com/id/10000664/device/rss/rss.html' },
  { name: 'MarketWatch',       category: 'fin', type: 'rss', url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories' },
  { name: 'DW Business',       category: 'fin', type: 'rss', url: 'https://rss.dw.com/rdf/rss-en-bus' },
  { name: 'France 24 Business',category: 'fin', type: 'rss', url: 'https://www.france24.com/en/business/rss' },
  { name: 'ECB',               category: 'fin', type: 'rss', url: 'https://www.ecb.europa.eu/rss/press.html' },
  { name: 'Federal Reserve',   category: 'fin', type: 'rss', url: 'https://www.federalreserve.gov/feeds/press_all.xml' },
];

const DAYS = { cyber: 21, geo: 21, fin: 21 };   // keep 3 weeks of news; older stories are deleted
const MAX_PER_COLUMN = 2000;
const USER_AGENT = 'Mozilla/5.0 (compatible; SignalFeed/1.0; personal news reader)';
const OUT_DIR = 'site/data';

// ---------- TEXT HELPERS ----------
const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—', hellip: '…', eacute: 'é', egrave: 'è', agrave: 'à', ccedil: 'ç' };
export function decode(s) {
  return String(s || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&([a-z]+);/gi, (m, n) => NAMED[n.toLowerCase()] ?? m);
}
const unCdata = s => String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
export function cleanText(s, max = 0) {
  let t = decode(unCdata(s));             // escaped HTML -> real HTML
  t = t.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
       .replace(/<[^>]+>/g, ' ');           // strip tags
  t = decode(t)                             // entities that were inside the HTML
       .replace(/The post .{0,300}? (appeared|first appeared) (first )?on .{0,80}?\.\s*$/i, '')
       .replace(/\[(\.\.\.|…)\]/g, '…')
       .replace(/\s+/g, ' ').trim();
  if (max && t.length > max) t = t.slice(0, max).replace(/\s+\S*$/, '') + '…';
  return t;
}
export function normalizeLink(url) {
  try {
    const u = new URL(String(url).trim());
    u.search = ''; u.hash = '';             // drop tracking like ?traffic_source=rss
    return u.toString();
  } catch { return ''; }
}

// ---------- PARSERS ----------
export function parseFeed(xml) {
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  return blocks.map(b => {
    const get = tag => {
      const m = b.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i'));
      return m ? m[1] : '';
    };
    let link = unCdata(get('link')).trim();
    if (!link) {
      const alt = b.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i) || b.match(/<link[^>]*href=["']([^"']+)["']/i);
      if (alt) link = alt[1];
    }
    if (!link) {
      const g = b.match(/<guid[^>]*isPermaLink=["']true["'][^>]*>([\s\S]*?)<\/guid>/i);
      if (g) link = unCdata(g[1]).trim();
    }
    return {
      title: cleanText(get('title')),
      link: decode(link),
      description: cleanText(get('description') || get('summary') || get('content:encoded') || get('content'), 320),
      date: cleanText(get('pubDate') || get('dc:date') || get('published') || get('updated')),
      categories: [...b.matchAll(/<category[^>]*>([\s\S]*?)<\/category>/gi)].map(m => cleanText(m[1])),
    };
  });
}

const meta = (html, prop) => {
  const a = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']`, 'i'));
  const b = html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`, 'i'));
  return decode((a || b || [])[1] || '');
};

// BleepingComputer home page times are US Eastern; convert to an exact moment.
function easternToISO(dateText, timeText) {
  const base = new Date(`${dateText} ${timeText} UTC`);
  if (isNaN(base)) return '';
  const offset = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', timeZoneName: 'shortOffset' })
    .formatToParts(base).find(p => p.type === 'timeZoneName')?.value || 'GMT-5';   // e.g. "GMT-4"
  const hours = parseInt(offset.replace('GMT', '') || '0', 10);
  return new Date(base.getTime() - hours * 3600e3).toISOString();
}
export function parseBleepingHome(html) {
  const items = [];
  const blocks = html.split(/<div class="bc_latest_news_text">/i).slice(1);
  for (const b of blocks) {
    const a = b.match(/<h4>\s*<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!a || !/\/news\//.test(a[1])) continue;
    const desc = b.match(/<p>([\s\S]*?)<\/p>/i);
    const d = b.match(/bc_news_date[^>]*>([^<]+)</i);
    const t = b.match(/bc_news_time[^>]*>([^<]+)</i);
    items.push({
      title: cleanText(a[2]), link: decode(a[1]),
      description: desc ? cleanText(desc[1], 320) : '',
      date: d && t ? easternToISO(d[1].trim(), t[1].trim()) : '',
    });
  }
  return items;
}
export function parseClarotyIndex(html) {
  // The page may use full addresses or short ones like /team82/research/<name>.
  const slugs = [...html.matchAll(/(?:https:\/\/(?:www\.)?claroty\.com)?\/team82\/research\/([a-z0-9][a-z0-9-]*)/gi)].map(m => m[1].toLowerCase());
  return [...new Set(slugs)].map(s => `https://claroty.com/team82/research/${s}`);
}
export function parseClarotyArticle(html, link) {
  return {
    title: cleanText(meta(html, 'og:title')),
    link,
    description: cleanText(meta(html, 'og:description') || meta(html, 'description'), 320),
    date: meta(html, 'article:published_time')
       || (html.match(/"datePublished"\s*:\s*"([^"]+)"/) || [])[1]
       || (html.match(/<time[^>]+datetime=["']([^"']+)["']/i) || [])[1]
       || '',
  };
}

// ---------- FETCH ----------
async function get(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/rss+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.8' },
    signal: AbortSignal.timeout(20000),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function readSource(src, previousLinks) {
  if (src.type === 'rss') return parseFeed(await get(src.url));
  if (src.type === 'bleeping-home') return parseBleepingHome(await get(src.url));
  if (src.type === 'claroty') {
    const links = parseClarotyIndex(await get(src.url)).slice(0, 6);
    const out = [];
    for (const link of links) {
      if (previousLinks.has(normalizeLink(link))) continue;  // already have it, don't re-download
      try { out.push(parseClarotyArticle(await get(link), link)); } catch { /* skip one bad page */ }
    }
    return out;
  }
  throw new Error('unknown source type');
}

// ---------- MAIN ----------
async function loadPrevious() {
  const base = process.env.SITE_URL;
  if (!base) return { items: [] };
  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/data/headlines.json?t=${Date.now()}`, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return { items: [] };
    return await res.json();
  } catch { return { items: [] }; }
}

export async function main() {
  const now = Date.now();
  const previous = await loadPrevious();
  const byLink = new Map();
  for (const it of previous.items || []) {
    // Re-apply today's filters to stories kept from earlier runs, so a tightened filter cleans up old ones too.
    const rules = SOURCES.filter(s => s.name === it.source && s.keep);
    if (rules.some(s => !s.keep(it))) continue;
    byLink.set(it.link, it);
  }

  const results = await Promise.allSettled(SOURCES.map(s => readSource(s, new Set(byLink.keys()))));
  const health = new Map(); // one line per source name

  results.forEach((r, i) => {
    const src = SOURCES[i];
    const h = health.get(src.name) || { name: src.name, category: src.category, ok: false, found: 0, error: '' };
    if (r.status === 'rejected') {
      if (!src.backup) h.error = String(r.reason?.message || r.reason).slice(0, 120);
      health.set(src.name, h);
      return;
    }
    let found = 0;
    for (const raw of r.value) {
      if (!raw.title || !raw.link) continue;
      src.fix?.(raw);
      if (src.keep && !src.keep(raw)) continue;
      const link = normalizeLink(raw.link);
      const t = new Date(raw.date).getTime();
      if (!link || isNaN(t) || t > now + 3600e3) continue;
      if (now - t > (src.days || DAYS[src.category]) * 864e5) continue;
      found++;
      const existing = byLink.get(link);
      if (existing) {
        if (!existing.description && raw.description) existing.description = raw.description;
        continue;
      }
      byLink.set(link, {
        title: raw.title, link, source: src.name, category: src.category,
        date: new Date(t).toISOString(), description: raw.description || '',
        firstSeen: new Date(now).toISOString(),
      });
    }
    h.ok = true; h.found += found;
    if (!src.backup) h.error = '';
    health.set(src.name, h);
  });

  // Drop expired items, keep newest first, cap each column.
  const items = [];
  for (const cat of ['cyber', 'geo', 'fin']) {
    items.push(...[...byLink.values()]
      .filter(it => it.category === cat)
      .filter(it => {
        const src = SOURCES.find(s => s.name === it.source);
        return now - new Date(it.date).getTime() <= ((src && src.days) || DAYS[cat]) * 864e5;
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, MAX_PER_COLUMN));
  }

  const sources = [...health.values()].map(h => {
    const mine = items.filter(it => it.source === h.name);
    return { ...h, stored: mine.length, newest: mine[0]?.date || null };
  });

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(`${OUT_DIR}/headlines.json`, JSON.stringify({ generatedAt: new Date(now).toISOString(), sources, items }));
  for (const s of sources) console.log(`${s.ok ? 'OK  ' : 'FAIL'} ${s.name.padEnd(18)} found ${String(s.found).padStart(3)}  stored ${String(s.stored).padStart(3)}  ${s.error}`);
  console.log(`Wrote ${items.length} headlines.`);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch(e => { console.error(e); process.exit(1); });
